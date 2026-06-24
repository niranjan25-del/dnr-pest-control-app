// src/modules/addresses/geocoding.service.ts
//
// Google Maps Geocoding wrapper. Validates + normalizes a postal address and returns
// coordinates. Resilient by design:
//   • No GOOGLE_MAPS_API_KEY configured → geocoding is "disabled"; callers fall back to
//     client-supplied coordinates (no hard failure in dev/test).
//   • ZERO_RESULTS / API error with no fallback coords → INVALID_ADDRESS.
// Add GOOGLE_MAPS_API_KEY to your environment (optionally to env.validation as optional).

import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GeocodeResult } from "./interfaces";

interface GoogleComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);
  private readonly apiKey?: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>("GOOGLE_MAPS_API_KEY");
  }

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /** Geocode a free-form address. Returns null when geocoding is disabled (no key). */
  async geocode(addressLine: string): Promise<GeocodeResult | null> {
    if (!this.enabled) {
      this.logger.warn("Geocoding disabled (no GOOGLE_MAPS_API_KEY); skipping");
      return null;
    }
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", addressLine);
    url.searchParams.set("key", this.apiKey!);

    let body: {
      status: string;
      results: Array<{
        geometry: { location: { lat: number; lng: number } };
        formatted_address: string;
        address_components: GoogleComponent[];
      }>;
    };
    try {
      const res = await fetch(url.toString());
      body = await res.json();
    } catch (err) {
      this.logger.error(`Geocoding request failed: ${(err as Error).message}`);
      throw new BadRequestException({
        code: "GEOCODING_FAILED",
        message: "Unable to validate address right now",
      });
    }

    if (body.status === "ZERO_RESULTS" || !body.results?.length) {
      throw new BadRequestException({
        code: "INVALID_ADDRESS",
        message: "Address could not be located",
      });
    }
    if (body.status !== "OK") {
      this.logger.error(`Geocoding status ${body.status}`);
      throw new BadRequestException({
        code: "GEOCODING_FAILED",
        message: "Address validation service error",
      });
    }

    const top = body.results[0];
    const get = (type: string) =>
      top.address_components.find((c) => c.types.includes(type));
    return {
      latitude: top.geometry.location.lat,
      longitude: top.geometry.location.lng,
      formattedAddress: top.formatted_address,
      normalized: {
        city:
          get("locality")?.long_name ??
          get("administrative_area_level_2")?.long_name,
        state: get("administrative_area_level_1")?.long_name,
        postalCode: get("postal_code")?.long_name,
        country: get("country")?.short_name,
      },
    };
  }
}
