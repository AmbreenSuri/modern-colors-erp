import { AiExtractionService } from './ai-extraction.service';

// normalize() is the deterministic JSON-mapping half of extraction (item 1). We test
// it directly with representative Claude tool outputs — no network/key needed.
describe('AiExtractionService.normalize (PO field mapping)', () => {
  const svc = new AiExtractionService({} as never, {} as never);
  const normalize = (input: unknown) =>
    (svc as unknown as { normalize: (i: Record<string, unknown>) => unknown }).normalize(
      input as Record<string, unknown>,
    );

  it('keeps HSN, SKU, quantity and weight in their own fields', () => {
    const res = normalize({
      poNumber: 'PKD/26-27/120',
      supplier: 'P.K. Dyes',
      lineItems: [
        { materialName: 'TEGO DISPERS 673', hsnCode: '39072090', sku: null, quantity: 4, unit: 'Drum', weight: 25 },
      ],
    }) as { lineItems: Record<string, unknown>[] };
    const li = res.lineItems[0];
    expect(li.hsnCode).toBe('39072090');
    expect(li.sku).toBeNull();
    expect(li.quantity).toBe(4); // physical package count, not the 100 Kg total
    expect(li.unit).toBe('Drum');
    expect(li.weight).toBe(25);
  });

  it('rescues an HSN code wrongly placed in SKU (defends the old mis-mapping bug)', () => {
    const res = normalize({
      lineItems: [{ materialName: 'CHINA CLAY POWDER', sku: '25070029', quantity: 1 }],
    }) as { lineItems: Record<string, unknown>[] };
    const li = res.lineItems[0];
    expect(li.hsnCode).toBe('25070029'); // moved out of sku
    expect(li.sku).toBeNull();
  });

  it('does NOT treat a real alphanumeric SKU as an HSN code', () => {
    const res = normalize({
      lineItems: [{ materialName: 'Resin', hsnCode: '39079990', sku: 'ACEM-300', quantity: 2 }],
    }) as { lineItems: Record<string, unknown>[] };
    expect(res.lineItems[0].sku).toBe('ACEM-300');
    expect(res.lineItems[0].hsnCode).toBe('39079990');
  });

  it('floors/guards quantity and drops nameless rows', () => {
    const res = normalize({
      lineItems: [
        { materialName: 'A', quantity: 2.9 },
        { materialName: '', quantity: 5 },
        { materialName: 'B', quantity: 0 },
      ],
    }) as { lineItems: Record<string, unknown>[] };
    expect(res.lineItems).toHaveLength(2);
    expect(res.lineItems[0].quantity).toBe(2); // floored
    expect(res.lineItems[1].quantity).toBe(1); // 0 → safe default of 1
  });

  it('BULK GUARD: a KG line never becomes a package count (the 2600-QR bug)', () => {
    const res = normalize({
      lineItems: [
        { materialName: 'CARB-10 B', hsnCode: '25174100', quantity: 2300, unit: 'KG' },
        { materialName: 'CHINA CLAY POWDER', hsnCode: '25070029', quantity: 300, unit: 'KG' },
      ],
    }) as { lineItems: Record<string, unknown>[] };
    expect(res.lineItems[0].quantity).toBe(1); // NOT 2300
    expect(res.lineItems[0].bulkWeightKg).toBe(2300); // surfaced for the operator
    expect(res.lineItems[1].quantity).toBe(1); // NOT 300
    expect(res.lineItems[1].bulkWeightKg).toBe(300);
  });

  it('BULK GUARD handles unit variants (KGS/Ltr/Kg.) case-insensitively', () => {
    const res = normalize({
      lineItems: [
        { materialName: 'X', quantity: 500, unit: 'KGS' },
        { materialName: 'Y', quantity: 200, unit: 'Ltr' },
        { materialName: 'Z', quantity: 50, unit: 'Kg.' },
      ],
    }) as { lineItems: Record<string, unknown>[] };
    for (const li of res.lineItems) expect(li.quantity).toBe(1);
  });

  it('does NOT clamp a real package count (Bag/Drum stay as-is)', () => {
    const res = normalize({
      lineItems: [
        { materialName: 'Resin', quantity: 80, unit: 'Bag', weight: 25 },
        { materialName: 'Solvent', quantity: 4, unit: 'Drum', weight: 25 },
      ],
    }) as { lineItems: Record<string, unknown>[] };
    expect(res.lineItems[0].quantity).toBe(80);
    expect(res.lineItems[0].bulkWeightKg).toBeNull();
    expect(res.lineItems[1].quantity).toBe(4);
  });
});
