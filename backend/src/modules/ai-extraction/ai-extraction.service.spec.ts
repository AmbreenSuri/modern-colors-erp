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
});
