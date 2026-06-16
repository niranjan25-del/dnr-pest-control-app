# shared/
Cross-feature building blocks that are domain-aware but reusable across modules:
shared DTOs/enums, mappers, and helper services used by more than one feature module
(e.g. money/Decimal helpers, common guards/decorators like @CurrentUser, @Roles).
Keep framework-agnostic, dependency-light code here; anything truly global/technical
goes in common/, anything talking to an external system goes in infrastructure/.
