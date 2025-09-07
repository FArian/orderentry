'use client';

import { useEffect, useState } from 'react';
import { fhirGet } from '@/lib/fhir';

interface Category {
  code: string;
  display: string;
}

interface AllergyIntolerance {
  code?: { coding?: { display?: string }[]; text?: string };
  reaction?: {
    manifestation?: { coding?: { display?: string }[]; text?: string }[];
    severity?: string;
  }[];
}

const SUB_MENUS: Record<string, string[]> = {
  food: [
    'Frequent screens and individual allergens',
    'Food allergen - Screen',
  ],
  environment: [
    'Inhalation allergens - Screens',
    'Inhalation allergens - Grasses',
    'Inhalation allergens - Trees',
    'Inhalation allergens - Animals',
    'Inhalation allergens - Herbs',
    'Inhalation allergens - Mites',
    'Inhalation allergens - Mould',
  ],
  medication: ['Drug allergens - Common medications'],
  biologic: ['Biologic allergens - Vaccines', 'Biologic allergens - Extracts'],
};

export default function AllergyMenu() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [catError, setCatError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [results, setResults] = useState<Record<string, AllergyIntolerance[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<Record<string, string>>({});

  useEffect(() => {
    async function fetchCategories() {
      try {
        setCatLoading(true);
        const data = (await fhirGet(
          '/ValueSet/$expand?url=http://hl7.org/fhir/ValueSet/allergy-intolerance-category'
        )) as { expansion?: { contains?: Array<{ code: string; display: string }> } };
        const fetched = (data.expansion?.contains || []).map(
          (item: { code: string; display: string }) => ({
            code: item.code,
            display: item.display,
          })
        );
        setCategories(fetched.filter((c: Category) => SUB_MENUS[c.code]));
      } catch {
        setCatError('Failed to load categories');
      } finally {
        setCatLoading(false);
      }
    }
    fetchCategories();
  }, []);

  const toggleCategory = (code: string) => {
    setExpanded((prev) => ({ ...prev, [code]: !prev[code] }));
  };

  const fetchAllergies = async (categoryCode: string, key: string) => {
    setLoading((prev) => ({ ...prev, [key]: true }));
    setError((prev) => ({ ...prev, [key]: '' }));
    try {
      const data = (await fhirGet(
        `/AllergyIntolerance?category=${categoryCode}`
      )) as { entry?: Array<{ resource: AllergyIntolerance }> };
      const arr = (data.entry || []).map(
        (e: { resource: AllergyIntolerance }) => e.resource
      );
      setResults((prev) => ({ ...prev, [key]: arr }));
    } catch {
      setError((prev) => ({ ...prev, [key]: 'Failed to load allergies' }));
    } finally {
      setLoading((prev) => ({ ...prev, [key]: false }));
    }
  };

  return (
    <div className="rounded border bg-white p-4">
      <h2 className="mb-4 text-lg font-bold">Allergies</h2>
      {catLoading && <p className="text-sm text-gray-500">Loading categories...</p>}
      {catError && <p className="text-sm text-red-500">{catError}</p>}
      <div>
        {categories.map((cat) => (
          <div key={cat.code} className="mb-2">
            <button
              onClick={() => toggleCategory(cat.code)}
              className="flex w-full items-center justify-between rounded bg-gray-100 px-2 py-2 text-left hover:bg-gray-200"
            >
              <span>{cat.display}</span>
              <span>{expanded[cat.code] ? '-' : '+'}</span>
            </button>
            {expanded[cat.code] && (
              <div className="mt-2 ml-4">
                {(SUB_MENUS[cat.code] || []).map((label) => (
                  <div key={label} className="mb-2">
                    <button
                      onClick={() => fetchAllergies(cat.code, label)}
                      className="w-full rounded px-2 py-1 text-left text-sm hover:bg-gray-50"
                    >
                      {label}
                    </button>
                    {loading[label] && (
                      <p className="ml-4 text-sm text-gray-500">Loading...</p>
                    )}
                    {error[label] && (
                      <p className="ml-4 text-sm text-red-500">{error[label]}</p>
                    )}
                    {results[label] && (
                      <ul className="ml-4 mt-2 space-y-2">
                        {results[label].map((allergy, idx) => {
                          const allergen =
                            allergy.code?.coding?.[0]?.display ||
                            allergy.code?.text ||
                            'Unknown';
                          const reaction =
                            allergy.reaction?.[0]?.manifestation?.[0]?.coding?.[0]?.display ||
                            allergy.reaction?.[0]?.manifestation?.[0]?.text ||
                            'Unknown';
                          const severity = allergy.reaction?.[0]?.severity;

                          return (
                            <li key={idx} className="rounded bg-gray-50 p-2">
                              <p className="text-sm font-medium">{allergen}</p>
                              <p className="text-xs">Reaction: {reaction}</p>
                              {severity && (
                                <p className="text-xs">Severity: {severity}</p>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
