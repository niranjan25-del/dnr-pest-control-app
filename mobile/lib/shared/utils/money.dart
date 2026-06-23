// lib/shared/utils/money.dart
//
// Formats string Decimal amounts (the backend returns money as strings) with the right
// currency symbol. Defaults to INR per the API spec examples.

import 'package:intl/intl.dart';

class Money {
  Money._();

  static const _symbols = {'INR': '₹', 'USD': r'$', 'EUR': '€', 'GBP': '£'};

  static String format(String? amount, {String currency = 'INR'}) {
    final value = double.tryParse(amount ?? '') ?? 0;
    final symbol = _symbols[currency.toUpperCase()] ?? '$currency ';
    final formatter = NumberFormat.currency(symbol: symbol, decimalDigits: 2);
    return formatter.format(value);
  }
}
