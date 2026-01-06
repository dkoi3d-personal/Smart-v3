/**
 * CRUD Dashboard Template - Requirements
 */

import { TemplateRequirements } from '../types';

export const crudDashboardRequirements: TemplateRequirements = {
  text: `
## CRUD Dashboard (Pre-Built)

The following data management features are pre-scaffolded with working components, API routes, and tests:

### Data Table Component
- Sortable columns with click-to-sort
- Filterable data with search input
- Pagination with configurable page size
- Row selection for bulk actions
- Responsive design for mobile

### CRUD Operations
- Create: Modal form with validation
- Read: Data table with search and filters
- Update: Edit form pre-populated with data
- Delete: Confirmation dialog with soft delete option

### Dashboard Layout
- Sidebar navigation
- Header with user info
- Main content area with data table
- Action buttons for CRUD operations

### Pre-Built Components
- \`DataTable\` - Sortable, filterable table with TanStack Table
- \`Pagination\` - Page navigation with size selector
- \`FilterBar\` - Search and filter controls
- \`CrudForm\` - Reusable form for create/edit
- \`DeleteConfirmModal\` - Confirmation dialog
- \`DashboardLayout\` - Layout wrapper with sidebar

### Pre-Built API Routes
- \`GET /api/crud/[resource]\` - List with pagination
- \`POST /api/crud/[resource]\` - Create new record
- \`GET /api/crud/[resource]/[id]\` - Get single record
- \`PUT /api/crud/[resource]/[id]\` - Update record
- \`DELETE /api/crud/[resource]/[id]\` - Delete record

### Customization Needed
- Configure your data models in the resource handlers
- Add your specific columns to the DataTable
- Customize the form fields for your data
- Add business logic validation
`,
  priority: 8, // High but lower than auth
};
