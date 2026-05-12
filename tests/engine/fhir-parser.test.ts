import { describe, it, expect } from 'vitest';
import { parseFhirObservations, extractObservations } from '@/lib/fhir-parser';

describe('parseFhirObservations', () => {
  it('parses a single Observation', () => {
    const obs = {
      resourceType: 'Observation' as const,
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '2093-3', display: 'Cholesterol' }] },
      valueQuantity: { value: 195, unit: 'mg/dL' },
      effectiveDateTime: '2026-04-12',
    };
    const { biomarkers } = parseFhirObservations(obs);
    expect(biomarkers).toHaveLength(1);
    expect(biomarkers[0]).toMatchObject({ code: 'chol_total', value: 195, unit: 'mg/dL' });
  });

  it('parses a Bundle of Observations', () => {
    const bundle = {
      resourceType: 'Bundle' as const,
      type: 'collection',
      entry: [
        {
          resource: {
            resourceType: 'Observation' as const,
            code: { coding: [{ code: '2085-9' }] },
            valueQuantity: { value: 62, unit: 'mg/dL' },
          },
        },
        {
          resource: {
            resourceType: 'Observation' as const,
            code: { coding: [{ code: '2089-1' }] },
            valueQuantity: { value: 110, unit: 'mg/dL' },
          },
        },
      ],
    };
    const { biomarkers } = parseFhirObservations(bundle);
    expect(biomarkers.map(b => b.code).sort()).toEqual(['hdl', 'ldl']);
  });

  it('reports unmapped LOINC codes', () => {
    const obs = {
      resourceType: 'Observation' as const,
      code: { coding: [{ code: '99999-9', display: 'Made up' }] },
      valueQuantity: { value: 1, unit: 'x' },
    };
    const { biomarkers, unmapped } = parseFhirObservations(obs);
    expect(biomarkers).toHaveLength(0);
    expect(unmapped).toHaveLength(1);
    expect(unmapped[0]).toMatchObject({ loinc: '99999-9' });
  });

  it('skips observations without numeric values', () => {
    const obs = {
      resourceType: 'Observation' as const,
      code: { coding: [{ code: '2093-3' }] },
      valueQuantity: { unit: 'mg/dL' }, // no value
    };
    const { biomarkers } = parseFhirObservations(obs);
    expect(biomarkers).toHaveLength(0);
  });

  it('handles an array of Observations directly', () => {
    const arr = [
      {
        resourceType: 'Observation' as const,
        code: { coding: [{ code: '4548-4' }] },
        valueQuantity: { value: 5.4, unit: '%' },
      },
    ];
    const { biomarkers } = parseFhirObservations(arr);
    expect(biomarkers).toHaveLength(1);
    expect(biomarkers[0].code).toBe('hba1c');
  });

  it('extractObservations preserves single Observation shape', () => {
    const obs = { resourceType: 'Observation' as const, code: { coding: [{ code: '718-7' }] }, valueQuantity: { value: 15, unit: 'g/dL' } };
    expect(extractObservations(obs)).toHaveLength(1);
  });
});
