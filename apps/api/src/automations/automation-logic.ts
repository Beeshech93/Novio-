/** Trigger -> Condition -> Action engine primitives (pure, easy to test). */
export const TRIGGERS = ['order.created', 'payment.succeeded', 'appointment.created', 'customer.inactive'] as const;
export type TriggerType = (typeof TRIGGERS)[number];
export const ACTIONS = ['internal_notification', 'send_whatsapp', 'send_email', 'tag_customer'] as const;
export type ActionType = (typeof ACTIONS)[number];
export const OPS = ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains'] as const;

export interface Condition { field: string; op: (typeof OPS)[number]; value: string | number | boolean }

const get = (obj: unknown, path: string) => path.split('.').reduce<any>((o, k) => (o == null ? undefined : o[k]), obj);

/** All conditions must hold (AND). No conditions = always run. Unknown fields fail closed. */
export function conditionsMatch(conds: Condition[] | null | undefined, ctx: unknown): boolean {
  return (conds ?? []).every((c) => {
    const v = get(ctx, c.field);
    if (v === undefined || v === null) return false;
    switch (c.op) {
      case 'eq': return v == c.value;
      case 'neq': return v != c.value;
      case 'gt': return Number(v) > Number(c.value);
      case 'gte': return Number(v) >= Number(c.value);
      case 'lt': return Number(v) < Number(c.value);
      case 'lte': return Number(v) <= Number(c.value);
      case 'contains': return String(v).toLowerCase().includes(String(c.value).toLowerCase());
      default: return false;
    }
  });
}

const PLACEHOLDERS: Record<string, (ctx: any) => string> = {
  'customer.name': (c) => c.customer?.name ?? '',
  'business.name': (c) => c.business?.name ?? '',
};
/** Only whitelisted placeholders are substituted; anything else stays literal (no arbitrary data exposure). */
export const renderText = (tpl: string, ctx: unknown) =>
  tpl.replace(/\{\{\s*([a-z.]+)\s*\}\}/g, (m, key) => (PLACEHOLDERS[key] ? PLACEHOLDERS[key](ctx) : m));
