/**
 * Product Declaration
 * Shape and validation for a `core new product` scaffold — mirrors the
 * shipped Product/Module/Plan/PlanModule/ProductRole models in
 * `apps/api-iam/prisma/schema.prisma`.
 * @core/cli
 */

import { kebabToPascal, validateKebabCase } from '../utils/templates.js';

/** Declares a `Module` row for this product */
export interface ProductModuleDeclaration {
  id: string;
  name: string;
  description?: string;
  defaultUrl: string;
}

/** Declares a `Plan` row (+ its `PlanModule` joins) for this product */
export interface ProductPlanDeclaration {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency: string;
  billingInterval: string;
  maxUsers: number;
  /** Module ids (from `modules`) included in this plan */
  moduleIds: string[];
}

/** Declares a `ProductRole` row for this product */
export interface ProductRoleDeclaration {
  key: string;
  name: string;
}

/** The full declaration for one product: its `Product` row plus modules, plans, and roles */
export interface ProductDeclaration {
  id: string;
  name: string;
  description?: string;
  modules: ProductModuleDeclaration[];
  plans: ProductPlanDeclaration[];
  roles: ProductRoleDeclaration[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a product declaration against the shape the shipped schema requires:
 * unique module ids, unique plan ids, plans only reference declared modules,
 * unique role keys.
 */
export function validateProductDeclaration(declaration: ProductDeclaration): ValidationResult {
  const errors: string[] = [];

  try {
    validateKebabCase(declaration.id);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `Invalid product id "${declaration.id}".`);
  }

  if (!declaration.name.trim()) {
    errors.push('Product name is required.');
  }

  if (declaration.modules.length === 0) {
    errors.push('At least one module must be declared.');
  }

  const moduleIds = new Set<string>();
  for (const module of declaration.modules) {
    if (!module.id.trim()) {
      errors.push('Module id is required.');
    } else if (moduleIds.has(module.id)) {
      errors.push(`Duplicate module id "${module.id}".`);
    }
    moduleIds.add(module.id);

    if (!module.name.trim()) {
      errors.push(`Module "${module.id}" requires a name.`);
    }
    if (!module.defaultUrl.trim()) {
      errors.push(`Module "${module.id}" requires a defaultUrl.`);
    }
  }

  if (declaration.plans.length === 0) {
    errors.push('At least one plan must be declared.');
  }

  const planIds = new Set<string>();
  for (const plan of declaration.plans) {
    if (!plan.id.trim()) {
      errors.push('Plan id is required.');
    } else if (planIds.has(plan.id)) {
      errors.push(`Duplicate plan id "${plan.id}".`);
    }
    planIds.add(plan.id);

    if (plan.price < 0) {
      errors.push(`Plan "${plan.id}" price cannot be negative.`);
    }
    if (plan.currency.length !== 3) {
      errors.push(`Plan "${plan.id}" currency must be a 3-letter code.`);
    }
    if (plan.maxUsers <= 0) {
      errors.push(`Plan "${plan.id}" maxUsers must be positive.`);
    }
    for (const moduleId of plan.moduleIds) {
      if (!moduleIds.has(moduleId)) {
        errors.push(`Plan "${plan.id}" references unknown module "${moduleId}".`);
      }
    }
  }

  const roleKeys = new Set<string>();
  for (const role of declaration.roles) {
    if (!role.key.trim()) {
      errors.push('Role key is required.');
    } else if (roleKeys.has(role.key)) {
      errors.push(`Duplicate role key "${role.key}".`);
    }
    roleKeys.add(role.key);

    if (!role.name.trim()) {
      errors.push(`Role "${role.key}" requires a name.`);
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * A minimal, valid starter declaration for a new product — one module, one
 * plan covering it, and one role. Edit the generated `product.config.ts`
 * before seeding.
 */
export function createDefaultProductDeclaration(name: string): ProductDeclaration {
  validateKebabCase(name);
  const pascalName = kebabToPascal(name);
  const defaultModuleId = `${name}-core`;

  return {
    id: name,
    name: pascalName,
    description: `${pascalName} product`,
    modules: [
      {
        id: defaultModuleId,
        name: `${pascalName} Core`,
        description: 'Default module scaffolded for this product.',
        defaultUrl: `/${name}`,
      },
    ],
    plans: [
      {
        id: 'starter',
        name: 'Starter',
        description: 'Default plan scaffolded for this product.',
        price: 0,
        currency: 'USD',
        billingInterval: 'monthly',
        maxUsers: 5,
        moduleIds: [defaultModuleId],
      },
    ],
    roles: [
      {
        key: 'member',
        name: 'Member',
      },
    ],
  };
}
