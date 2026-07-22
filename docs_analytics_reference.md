# Waste Reduction Analytics Calculation Reference

- **Money Saved**: Sum(Item.Quantity * Item.EstimatedCost) for consumed/donated items.
- **Waste Reduced (kg)**: Sum(Item.Quantity * Item.WeightPerUnit).
- **CO2 Impact**: Waste Reduced (kg) * 2.5 kg CO2e/kg.
