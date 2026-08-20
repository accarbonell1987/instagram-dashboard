/**
 * Who a row belongs to.
 *
 * Passed as one object rather than two positional strings on purpose: a method
 * taking `(tenantId, userId, id)` is three interchangeable strings, and the day
 * two of them get swapped the query still runs and silently returns somebody
 * else's rows — or nothing at all.
 */
export interface Owner {
  tenantId: string;
  userId: string;
}

/**
 * Narrow the verified auth context down to who the row belongs to.
 *
 * The context also carries the role and the tenant slug. Handing a service the
 * whole thing type-checks — it is structurally an Owner — but it hands over
 * facts the service has no business reading, and it makes every test assert on
 * an object bigger than the contract.
 */
export function ownerOf(context: { tenantId: string; userId: string }): Owner {
  return { tenantId: context.tenantId, userId: context.userId };
}
