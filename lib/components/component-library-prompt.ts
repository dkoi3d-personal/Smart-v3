/**
 * Fleet Component Library - Agent Prompt Generator
 *
 * Generates a concise, consistent component API reference for agents.
 * This replaces verbose design system documentation with a unified API.
 */

/**
 * Generate the component library prompt for agents.
 * This is much smaller than full design system docs.
 */
export function generateComponentLibraryPrompt(): string {
  return `## Fleet Component Library

Use these components with the exact props shown. The design system adapter handles styling.

### Layout Components

\`\`\`tsx
// Stack - Flex container
<Stack direction="vertical" gap="md" align="center" justify="between">
  {children}
</Stack>

// Grid - Grid container
<Grid columns={{ sm: 1, md: 2, lg: 3 }} gap="md">
  {children}
</Grid>

// Container - Centered max-width container
<Container size="lg" centered padding="md">
  {children}
</Container>

// Divider
<Divider orientation="horizontal" label="or" />
\`\`\`

### Typography

\`\`\`tsx
// Heading - h1-h6
<Heading level={1} size="2xl" align="center">Title</Heading>

// Text - Paragraphs and inline text
<Text size="md" color="muted" weight="medium">Content</Text>

// Label - Form labels
<Label htmlFor="email" required>Email</Label>
\`\`\`

### Form Components

\`\`\`tsx
// Button
<Button variant="primary" size="md" loading={false} leftIcon={<Icon />}>
  Click me
</Button>
// Variants: primary | secondary | outline | ghost | destructive | link
// Sizes: xs | sm | md | lg | xl

// Input
<Input
  type="email"
  placeholder="Enter email"
  size="md"
  error={hasError}
  leftIcon={<MailIcon />}
  onChange={(value) => setValue(value)}
/>

// TextArea
<TextArea
  rows={4}
  placeholder="Enter message"
  resize="vertical"
  onChange={(value) => setValue(value)}
/>

// Select
<Select
  placeholder="Choose option"
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' }
  ]}
  onChange={(value) => setValue(value)}
/>

// Checkbox
<Checkbox
  checked={isChecked}
  label="I agree to terms"
  onChange={(checked) => setChecked(checked)}
/>

// RadioGroup
<RadioGroup
  value={selected}
  options={[
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' }
  ]}
  direction="vertical"
  onChange={(value) => setSelected(value)}
/>

// Switch
<Switch
  checked={isEnabled}
  label="Enable notifications"
  size="md"
  onChange={(checked) => setEnabled(checked)}
/>

// FormField - Wraps inputs with label/error
<FormField label="Email" error={errors.email} required>
  <Input type="email" error={!!errors.email} />
</FormField>
\`\`\`

### Data Display

\`\`\`tsx
// Card
<Card variant="default" padding="md" interactive onClick={() => {}}>
  <CardHeader title="Title" subtitle="Subtitle" action={<Button />} />
  <CardContent>{content}</CardContent>
  <CardFooter>{actions}</CardFooter>
</Card>
// Variants: default | outline | filled | elevated

// Badge
<Badge color="success" variant="solid" size="md">Active</Badge>
// Colors: success | warning | error | info | neutral | primary | secondary
// Variants: solid | outline | subtle

// Avatar
<Avatar src="/user.jpg" fallback="JD" size="md" shape="circle" status="online" />

// AvatarGroup
<AvatarGroup max={3} size="sm">
  <Avatar src="/user1.jpg" fallback="A" />
  <Avatar src="/user2.jpg" fallback="B" />
</AvatarGroup>

// Table
<Table
  data={users}
  rowKey="id"
  columns={[
    { key: 'name', header: 'Name', accessor: 'name', sortable: true },
    { key: 'email', header: 'Email', accessor: 'email' },
    { key: 'status', header: 'Status', accessor: (row) => <Badge>{row.status}</Badge> }
  ]}
  hoverable
  onRowClick={(row) => selectUser(row)}
/>

// List
<List variant="divided" gap="sm">
  <ListItem
    leftContent={<Avatar />}
    rightContent={<Button size="sm">View</Button>}
    interactive
    onClick={() => {}}
  >
    List item content
  </ListItem>
</List>
\`\`\`

### Feedback

\`\`\`tsx
// Alert
<Alert color="warning" variant="subtle" title="Warning" dismissible onDismiss={() => {}}>
  Please review your input.
</Alert>
// Colors: success | warning | error | info | neutral

// Progress
<Progress value={75} max={100} size="md" color="primary" showLabel />

// Spinner
<Spinner size="md" color="primary" label="Loading..." />

// Skeleton
<Skeleton width="100%" height={20} variant="text" animate />
// Variants: text | circular | rectangular | rounded
\`\`\`

### Overlays

\`\`\`tsx
// Modal
<Modal
  open={isOpen}
  onClose={() => setOpen(false)}
  title="Confirm Action"
  description="Are you sure?"
  size="md"
  footer={<Button onClick={confirm}>Confirm</Button>}
>
  {content}
</Modal>
// Sizes: sm | md | lg | xl | full

// Drawer
<Drawer
  open={isOpen}
  onClose={() => setOpen(false)}
  title="Settings"
  side="right"
  size="md"
>
  {content}
</Drawer>
// Sides: left | right | top | bottom

// Tooltip
<Tooltip content="Helpful tip" placement="top">
  <Button>Hover me</Button>
</Tooltip>

// Popover
<Popover
  trigger={<Button>Click me</Button>}
  placement="bottom-start"
  triggerMode="click"
>
  {popoverContent}
</Popover>

// DropdownMenu
<DropdownMenu trigger={<Button>Actions</Button>}>
  <DropdownMenuItem icon={<EditIcon />} onClick={handleEdit}>
    Edit
  </DropdownMenuItem>
  <DropdownMenuItem icon={<TrashIcon />} destructive onClick={handleDelete}>
    Delete
  </DropdownMenuItem>
</DropdownMenu>
\`\`\`

### Navigation

\`\`\`tsx
// Tabs
<Tabs value={tab} onChange={setTab} variant="default">
  <Tab value="tab1" label="First" icon={<Icon />} badge={3} />
  <Tab value="tab2" label="Second" />
</Tabs>
<TabPanel value="tab1">{content1}</TabPanel>
<TabPanel value="tab2">{content2}</TabPanel>
// Variants: default | pills | underline

// Breadcrumb
<Breadcrumb separator="/">
  <BreadcrumbItem href="/">Home</BreadcrumbItem>
  <BreadcrumbItem href="/products">Products</BreadcrumbItem>
  <BreadcrumbItem current>Details</BreadcrumbItem>
</Breadcrumb>

// NavMenu
<NavMenu orientation="vertical" collapsed={false}>
  <NavMenuItem href="/dashboard" icon={<DashboardIcon />} active>
    Dashboard
  </NavMenuItem>
  <NavMenuGroup label="Settings" icon={<SettingsIcon />}>
    <NavMenuItem href="/settings/profile">Profile</NavMenuItem>
    <NavMenuItem href="/settings/security">Security</NavMenuItem>
  </NavMenuGroup>
</NavMenu>
\`\`\`

### Common Patterns

**Form with validation:**
\`\`\`tsx
<form onSubmit={handleSubmit}>
  <Stack direction="vertical" gap="md">
    <FormField label="Email" error={errors.email} required>
      <Input type="email" value={email} onChange={setEmail} error={!!errors.email} />
    </FormField>
    <FormField label="Password" error={errors.password} required>
      <Input type="password" value={password} onChange={setPassword} error={!!errors.password} />
    </FormField>
    <Button type="submit" variant="primary" loading={isSubmitting} fullWidth>
      Sign In
    </Button>
  </Stack>
</form>
\`\`\`

**Data table with actions:**
\`\`\`tsx
<Card>
  <CardHeader title="Users" action={<Button size="sm" leftIcon={<PlusIcon />}>Add</Button>} />
  <CardContent>
    <Table
      data={users}
      rowKey="id"
      columns={[
        { key: 'name', header: 'Name', accessor: 'name' },
        { key: 'status', header: 'Status', accessor: (r) => <Badge color={r.active ? 'success' : 'neutral'}>{r.active ? 'Active' : 'Inactive'}</Badge> },
        { key: 'actions', header: '', accessor: (r) => (
          <DropdownMenu trigger={<Button size="sm" variant="ghost">...</Button>}>
            <DropdownMenuItem onClick={() => edit(r)}>Edit</DropdownMenuItem>
            <DropdownMenuItem destructive onClick={() => remove(r)}>Delete</DropdownMenuItem>
          </DropdownMenu>
        )}
      ]}
      hoverable
    />
  </CardContent>
</Card>
\`\`\`

**Dashboard stat card:**
\`\`\`tsx
<Card>
  <CardContent>
    <Stack direction="vertical" gap="xs">
      <Text size="sm" color="muted">Total Revenue</Text>
      <Heading level={3} size="xl">$45,231</Heading>
      <Badge color="success" variant="subtle" size="sm">+12.5%</Badge>
    </Stack>
  </CardContent>
</Card>
\`\`\`

### Size Reference
- xs: Extra small (compact)
- sm: Small (tight spacing)
- md: Medium (default)
- lg: Large (comfortable)
- xl: Extra large (spacious)

### Color Reference
- primary: Brand/action color
- secondary: Supporting color
- success: Positive/complete
- warning: Caution/attention
- error: Negative/destructive
- info: Informational
- neutral: Default/inactive
- muted: Subdued text
`;
}

/**
 * Generate a minimal component reference for context-limited situations.
 */
export function generateMinimalComponentPrompt(): string {
  return `## Fleet Components (Quick Reference)

**Layout:** Stack, Grid, Container, Divider
**Typography:** Heading, Text, Label
**Forms:** Button, Input, TextArea, Select, Checkbox, RadioGroup, Switch, FormField
**Data:** Card, Badge, Avatar, Table, List
**Feedback:** Alert, Progress, Spinner, Skeleton
**Overlay:** Modal, Drawer, Tooltip, Popover, DropdownMenu
**Nav:** Tabs, Breadcrumb, NavMenu

**Sizes:** xs | sm | md | lg | xl
**Colors:** primary | secondary | success | warning | error | info | neutral

**Button variants:** primary | secondary | outline | ghost | destructive | link
**Card variants:** default | outline | filled | elevated
**Badge variants:** solid | outline | subtle
`;
}

/**
 * Get component library prompt with optional design system tokens appended.
 */
export function getComponentLibraryPromptWithTokens(designSystemTokens?: string): string {
  const basePrompt = generateComponentLibraryPrompt();

  if (designSystemTokens) {
    return `${basePrompt}

---

## Design System Tokens

${designSystemTokens}
`;
  }

  return basePrompt;
}

export default {
  generateComponentLibraryPrompt,
  generateMinimalComponentPrompt,
  getComponentLibraryPromptWithTokens,
};
