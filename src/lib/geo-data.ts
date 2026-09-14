// Comprehensive Country & City Directory for Global & Regional Portal Listings

export interface CountryData {
  country: string;
  code: string;
  cities: string[];
}

export const COUNTRIES_AND_CITIES: CountryData[] = [
  {
    country: "Namibia",
    code: "NA",
    cities: [
      "Windhoek",
      "Walvis Bay",
      "Swakopmund",
      "Oshakati",
      "Rundu",
      "Katima Mulilo",
      "Otjiwarongo",
      "Keetmanshoop",
      "Tsumeb",
      "Gobabis",
      "Lüderitz",
      "Henties Bay",
      "Rehoboth",
      "Okahandja",
      "Mariental",
      "Ondangwa",
      "Grootfontein",
      "Karibib",
      "Usakos",
      "Oranjemund",
    ],
  },
  {
    country: "South Africa",
    code: "ZA",
    cities: [
      "Johannesburg",
      "Cape Town",
      "Durban",
      "Pretoria",
      "Port Elizabeth (Gqeberha)",
      "Bloemfontein",
      "East London",
      "Nelspruit (Mbombela)",
      "Kimberley",
      "Polokwane",
      "Pietermaritzburg",
      "George",
      "Rustenburg",
      "Soweto",
      "Sandton",
      "Centurion",
      "Stellenbosch",
      "Paarl",
      "Mossel Bay",
      "Knysna",
      "Plettenberg Bay",
      "Klerksdorp",
      "Potchefstroom",
      "Welkom",
      "Midrand",
    ],
  },
  {
    country: "Zimbabwe",
    code: "ZW",
    cities: [
      "Harare",
      "Bulawayo",
      "Chitungwiza",
      "Mutare",
      "Gweru",
      "Kwekwe",
      "Kadoma",
      "Masvingo",
      "Chinhoyi",
      "Norton",
      "Marondera",
      "Victoria Falls",
      "Zvishavane",
      "Hwange",
      "Beitbridge",
      "Bindura",
      "Redcliff",
      "Rusape",
      "Kariba",
    ],
  },
  {
    country: "Botswana",
    code: "BW",
    cities: [
      "Gaborone",
      "Francistown",
      "Molepolole",
      "Maun",
      "Serowe",
      "Selibe Phikwe",
      "Kasane",
      "Lobatse",
      "Kanye",
      "Mochudi",
      "Mahalapye",
      "Palapye",
      "Jwaneng",
      "Ghanzi",
      "Orapa",
    ],
  },
  {
    country: "Zambia",
    code: "ZM",
    cities: [
      "Lusaka",
      "Kitwe",
      "Ndola",
      "Kabwe",
      "Chingola",
      "Mufulira",
      "Luanshya",
      "Livingstone",
      "Kasama",
      "Chipata",
      "Solwezi",
      "Mansa",
      "Mazabuka",
      "Mongu",
      "Choma",
    ],
  },
  {
    country: "Angola",
    code: "AO",
    cities: [
      "Luanda",
      "Huambo",
      "Lobito",
      "Benguela",
      "Lubango",
      "Malanje",
      "Namibe",
      "Cabinda",
      "Uige",
      "Soyo",
    ],
  },
  {
    country: "Mozambique",
    code: "MZ",
    cities: [
      "Maputo",
      "Matola",
      "Beira",
      "Nampula",
      "Chimoio",
      "Nacala",
      "Quelimane",
      "Tete",
      "Pemba",
      "Xai-Xai",
      "Inhambane",
    ],
  },
  {
    country: "Kenya",
    code: "KE",
    cities: [
      "Nairobi",
      "Mombasa",
      "Kisumu",
      "Nakuru",
      "Eldoret",
      "Malindi",
      "Naivasha",
      "Kitale",
      "Thika",
      "Machakos",
      "Nyeri",
      "Diani Beach",
    ],
  },
  {
    country: "Tanzania",
    code: "TZ",
    cities: [
      "Dar es Salaam",
      "Dodoma",
      "Mwanza",
      "Arusha",
      "Zanzibar City",
      "Mbeya",
      "Morogoro",
      "Tanga",
      "Moshi",
      "Kigoma",
    ],
  },
  {
    country: "Nigeria",
    code: "NG",
    cities: [
      "Lagos",
      "Abuja",
      "Kano",
      "Ibadan",
      "Port Harcourt",
      "Benin City",
      "Enugu",
      "Kaduna",
      "Jos",
      "Ilorin",
      "Warri",
      "Calabar",
      "Abeokuta",
    ],
  },
  {
    country: "Ghana",
    code: "GH",
    cities: [
      "Accra",
      "Kumasi",
      "Tamale",
      "Sekondi-Takoradi",
      "Sunyani",
      "Cape Coast",
      "Tema",
      "Koforidua",
    ],
  },
  {
    country: "Rwanda",
    code: "RW",
    cities: [
      "Kigali",
      "Butare (Huye)",
      "Gisenyi (Rubavu)",
      "Ruhengeri (Musanze)",
      "Gitarama (Muhanga)",
      "Kibuye (Karongi)",
    ],
  },
  {
    country: "Uganda",
    code: "UG",
    cities: [
      "Kampala",
      "Entebbe",
      "Jinja",
      "Gulu",
      "Mbarara",
      "Mbale",
      "Fort Portal",
      "Masaka",
      "Arua",
    ],
  },
  {
    country: "United Kingdom",
    code: "GB",
    cities: [
      "London",
      "Manchester",
      "Birmingham",
      "Edinburgh",
      "Glasgow",
      "Liverpool",
      "Bristol",
      "Leeds",
      "Sheffield",
      "Newcastle",
      "Belfast",
      "Cardiff",
      "Oxford",
      "Cambridge",
      "Brighton",
    ],
  },
  {
    country: "United States",
    code: "US",
    cities: [
      "New York",
      "Los Angeles",
      "Chicago",
      "Houston",
      "Phoenix",
      "Philadelphia",
      "San Antonio",
      "San Diego",
      "Dallas",
      "Austin",
      "San Jose",
      "Miami",
      "San Francisco",
      "Seattle",
      "Denver",
      "Boston",
      "Las Vegas",
      "Atlanta",
      "Orlando",
      "Washington D.C.",
    ],
  },
  {
    country: "Canada",
    code: "CA",
    cities: [
      "Toronto",
      "Montreal",
      "Vancouver",
      "Calgary",
      "Edmonton",
      "Ottawa",
      "Winnipeg",
      "Quebec City",
      "Hamilton",
      "Halifax",
      "Victoria",
    ],
  },
  {
    country: "Australia",
    code: "AU",
    cities: [
      "Sydney",
      "Melbourne",
      "Brisbane",
      "Perth",
      "Adelaide",
      "Gold Coast",
      "Canberra",
      "Newcastle",
      "Hobart",
      "Darwin",
      "Cairns",
    ],
  },
  {
    country: "United Arab Emirates",
    code: "AE",
    cities: [
      "Dubai",
      "Abu Dhabi",
      "Sharjah",
      "Ajman",
      "Ras Al Khaimah",
      "Fujairah",
      "Al Ain",
      "Umm Al Quwain",
    ],
  },
  {
    country: "Germany",
    code: "DE",
    cities: [
      "Berlin",
      "Munich",
      "Frankfurt",
      "Hamburg",
      "Cologne",
      "Stuttgart",
      "Düsseldorf",
      "Leipzig",
      "Dresden",
    ],
  },
  {
    country: "France",
    code: "FR",
    cities: [
      "Paris",
      "Marseille",
      "Lyon",
      "Toulouse",
      "Nice",
      "Nantes",
      "Strasbourg",
      "Montpellier",
      "Bordeaux",
      "Lille",
    ],
  },
];

/**
 * Returns a sorted list of all countries, merging predefined countries with any
 * custom country names present in live listings.
 */
export function getAllCountries(dynamicItems: Array<{ country?: string | null }> = []): string[] {
  const set = new Set<string>();
  COUNTRIES_AND_CITIES.forEach((c) => set.add(c.country));

  dynamicItems.forEach((item) => {
    if (item.country && item.country.trim()) {
      set.add(item.country.trim());
    }
  });

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns a sorted list of all cities for a specific country, merging predefined
 * cities with any custom cities found in live listings for that country.
 */
export function getCitiesForCountry(
  countryName: string,
  dynamicItems: Array<{ country?: string | null; city?: string | null }> = []
): string[] {
  if (!countryName || !countryName.trim()) return [];

  const normalized = countryName.trim().toLowerCase();
  const set = new Set<string>();

  const match = COUNTRIES_AND_CITIES.find(
    (c) => c.country.toLowerCase() === normalized || c.code.toLowerCase() === normalized
  );

  if (match) {
    match.cities.forEach((city) => set.add(city));
  }

  dynamicItems.forEach((item) => {
    if (item.country && item.country.trim().toLowerCase() === normalized && item.city && item.city.trim()) {
      set.add(item.city.trim());
    }
  });

  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

