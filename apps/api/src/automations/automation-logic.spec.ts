import { conditionsMatch, renderText } from './automation-logic';

describe('automation logic', () => {
  const ctx = { payment: { amount: 250, status: 'SUCCEEDED' }, customer: { name: 'Ana', tags: 'vip,frecuente' } };
  it('AND semantics and operators', () => {
    expect(conditionsMatch([{ field: 'payment.amount', op: 'gte', value: 200 }, { field: 'payment.status', op: 'eq', value: 'SUCCEEDED' }], ctx)).toBe(true);
    expect(conditionsMatch([{ field: 'payment.amount', op: 'gt', value: 300 }], ctx)).toBe(false);
    expect(conditionsMatch([{ field: 'customer.tags', op: 'contains', value: 'VIP' }], ctx)).toBe(true);
    expect(conditionsMatch([], ctx)).toBe(true);
    expect(conditionsMatch(null, ctx)).toBe(true);
  });
  it('unknown fields fail closed', () => expect(conditionsMatch([{ field: 'nope.x', op: 'eq', value: 1 }], ctx)).toBe(false));
  it('renders only whitelisted placeholders', () => {
    expect(renderText('Hola {{customer.name}} de {{ business.name }} {{secret.key}}', { customer: { name: 'Ana' }, business: { name: 'B' } })).toBe('Hola Ana de B {{secret.key}}');
  });
});
