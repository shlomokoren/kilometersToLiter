// Small built-in make/model catalog used to seed the `car_catalog` table.
// Anything not covered here is looked up from the NHTSA vPIC API at runtime
// and cached into `car_catalog` for future lookups (see lib/vehicleApi.js).
module.exports = [
  { make: 'Toyota', models: ['Corolla', 'Camry', 'RAV4', 'Yaris', 'Hilux', 'Prius'] },
  { make: 'Honda', models: ['Civic', 'Accord', 'CR-V', 'Fit', 'HR-V'] },
  { make: 'Ford', models: ['Focus', 'Fiesta', 'F-150', 'Escape', 'Mustang'] },
  { make: 'Chevrolet', models: ['Cruze', 'Malibu', 'Silverado', 'Equinox', 'Spark'] },
  { make: 'Nissan', models: ['Altima', 'Sentra', 'Qashqai', 'Micra', 'X-Trail'] },
  { make: 'Hyundai', models: ['Elantra', 'Tucson', 'Santa Fe', 'i10', 'i20'] },
  { make: 'Kia', models: ['Sportage', 'Sorento', 'Rio', 'Ceed', 'Picanto'] },
  { make: 'BMW', models: ['3 Series', '5 Series', 'X3', 'X5', '1 Series'] },
  { make: 'Mercedes-Benz', models: ['C-Class', 'E-Class', 'A-Class', 'GLC', 'S-Class'] },
  { make: 'Audi', models: ['A3', 'A4', 'A6', 'Q5', 'Q3'] },
  { make: 'Volkswagen', models: ['Golf', 'Polo', 'Passat', 'Tiguan', 'Jetta'] },
  { make: 'Mazda', models: ['Mazda3', 'Mazda6', 'CX-5', 'CX-3'] },
  { make: 'Subaru', models: ['Impreza', 'Outback', 'Forester', 'XV'] },
  { make: 'Jeep', models: ['Wrangler', 'Cherokee', 'Grand Cherokee', 'Compass'] },
  { make: 'Tesla', models: ['Model 3', 'Model Y', 'Model S', 'Model X'] },
  { make: 'Volvo', models: ['XC40', 'XC60', 'XC90', 'S60'] },
  { make: 'Peugeot', models: ['208', '308', '2008', '3008'] },
  { make: 'Renault', models: ['Clio', 'Megane', 'Captur', 'Kadjar'] },
  { make: 'Fiat', models: ['500', 'Panda', 'Tipo'] },
  { make: 'Skoda', models: ['Octavia', 'Fabia', 'Superb', 'Kodiaq'] },
];
