/**
 * CRUD Dashboard Template
 * Complete data management with tables, forms, and API routes
 */

import { FeatureTemplate } from '../types';
import { crudDashboardFiles } from './files';
import { crudDashboardTests } from './tests';
import { crudDashboardRequirements } from './requirements';

export const crudDashboardTemplate: FeatureTemplate = {
  id: 'crud-dashboard',
  name: 'CRUD Dashboard',
  version: '1.0.0',
  description: 'Complete data management with sortable tables, forms, pagination, and CRUD API routes',
  category: 'data',

  keywords: [
    'dashboard',
    'admin',
    'crud',
    'table',
    'data table',
    'list',
    'manage',
    'management',
    'pagination',
    'filter',
    'sort',
    'create',
    'read',
    'update',
    'delete',
    'admin panel',
    'back office',
    'data grid',
  ],

  patterns: [
    'admin.*panel',
    'dashboard.*page',
    'data.*table',
    'crud.*operation',
    'manage.*data',
    'list.*items',
  ],

  files: crudDashboardFiles,
  tests: crudDashboardTests,
  requirements: crudDashboardRequirements,

  dependencies: {
    packages: {
      '@tanstack/react-table': '^8.10.0',
      'zod': '^3.22.0',
    },
    devPackages: {},
    expectedModels: [],
  },

  agentInstructions: `
## CRUD Dashboard Template Customization

### What's Pre-Built:
- DataTable component with sorting, filtering, pagination
- Pagination component with page size selector
- FilterBar component with search input
- CrudForm component for create/edit operations
- DeleteConfirmModal for deletion confirmation
- FormModal wrapper for form dialogs
- useCrud hook for data operations
- Generic CRUD API routes at /api/crud/[resource]

### File Locations:
- Components: \`components/data-table/\`, \`components/forms/\`, \`components/modals/\`
- API Routes: \`app/api/crud/[resource]/route.ts\`
- Hooks: \`hooks/useCrud.ts\`
- Tests: \`__tests__/crud/\`

### Required Customizations:
1. Add your Prisma models to RESOURCE_MAP in the API routes
2. Define columns for your data in DataTable
3. Define form fields for CrudForm
4. Add business logic validation

### How to Use:

1. **Register your model** in \`app/api/crud/[resource]/route.ts\`:
\`\`\`typescript
const RESOURCE_MAP = {
  users: prisma.user,
  products: prisma.product,
};
\`\`\`

2. **Create a page with DataTable**:
\`\`\`tsx
const columns = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'email', header: 'Email' },
];

<DataTable
  data={data}
  columns={columns}
  onEdit={handleEdit}
  onDelete={handleDelete}
/>
\`\`\`

3. **Use the useCrud hook**:
\`\`\`tsx
const { data, loading, fetchList, create, update, remove } = useCrud({
  resource: 'users',
});
\`\`\`

### DO NOT Modify:
- DataTable core logic (sorting, filtering work correctly)
- Pagination calculations
- useCrud fetch/mutate logic
`,
};
