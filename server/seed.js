// First-run data. After that, everything lives in data/db.json and is edited from the admin dashboard.
module.exports = {
  units: [
    { id: "one", name: "Penthouse One", price: 11000, cap: 4, beds: "2 bedrooms", blurb: "A top-floor A-frame home with a double-height living room under a hand-painted Kenyan mural, and a terrace facing the lake.", images: ["/uploads/lounge.jpg", "/uploads/mural.jpg"] },
    { id: "two", name: "Penthouse Two", price: 18000, cap: 6, beds: "3 bedrooms", blurb: "Our larger penthouse: warm terracotta interiors, a mezzanine landing and a sunrise-facing terrace, with room for the whole family.", images: ["/uploads/dancers.jpg", "/uploads/bed.jpg"] }
  ],
  bookings: [], blocks: [], mpesa: [],
  settings: { depositPercent: 30, till: "000000", hero: "/uploads/hero.jpg",
    murals: [{ url: "/uploads/mwoman.jpg", caption: "The savanna, painted above the lounge" }, { url: "/uploads/mdance.jpg", caption: "Dancers against the setting sun" }] }
};
