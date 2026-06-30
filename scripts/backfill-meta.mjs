// One-off: backfill campaign identity metadata to the live API.
const BASE = process.env.BASE || 'https://stellarfund-xi.vercel.app';
const DATA = [
  ['CA55N6JECXNMPOQ526745DQYJX6ZMRSQVB5YKVPNHUQUJCAJNE5VR2SP', 'Community library books', 'Stocking a neighbourhood library with new books for students.', 'Education', 'StellarFund'],
  ['CAO5EVDG45PAXPWPD7ODADKKMXI4KMUEL64LZDMAD7URVNAGID4XXBJI', 'Bakery in Nairobi', 'Help a family bakery buy an oven and ingredients, released as milestones are met.', 'Community', 'Amina'],
  ['CCSUG22GKCWDX3SNGTIBRFQJYKISYXELS3RC3OPNUPATFKXRACYUOJAF', 'Solar pump for a farm', 'A solar water pump to irrigate a smallholder farm year-round.', 'Technology', 'Kwame'],
  ['CC57M4VOCIAFC5SRG52HPBW2VT6UKKQ7MXBJJVYBP4NXN2U3VBMF5IIB', 'School laptops for kids', 'Refurbished laptops for a rural classroom to learn coding.', 'Education', 'Mr. Okoro'],
  ['CB3E5XIN27FIHLO7LZOGQU74DNVE3CBKHB2456IXWJFZ3ECZIJJUUXNB', 'Flood relief fund', 'Emergency supplies for families displaced by seasonal floods.', 'Emergency', 'Relief Team'],
  ['CB2HABXKI2PT2SNXU4OZB4JVNVEMU5EQ3SSGBPYPBZPQ5JEQWFP5HC33', 'Village clinic supplies', 'Basic medical supplies and a cold chain for a rural clinic.', 'Health', 'Dr. Sara'],
  ['CB64CADLHIYF4F7IQJEWRRK7BAPJ6243OEBHS4H5PAUFLFBP4WQULXRZ', 'Local makerspace', 'Tools and 3D printers for a community makerspace and workshops.', 'Technology', 'Deniz'],
];
for (const [address, title, description, category, creatorName] of DATA) {
  const res = await fetch(BASE + '/api/campaigns', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, title, description, category, creatorName, imageUrl: null, createdAt: new Date().toISOString() }),
  });
  console.log(res.status, title, res.ok ? 'ok' : await res.text());
}
