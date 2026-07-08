import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  Field,
  Input,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  Spinner,
  Textarea,
} from '@core/ui';
import { ChevronDownIcon, SearchIcon } from 'lucide-react';

import { Example, ExampleWrapper } from '@/components/example';
import { FieldExamples } from '@/components/field-examples';

export default function ComponentsPage() {
  return (
    <main className="bg-background min-h-screen">
      <ExampleWrapper>
        <CardExample />
        <BadgeExamples />
        <ButtonExamples />
        <FieldExamples />
        <ItemExample />
        <InputGroupExamples />
        <SheetExample />
        <EmptyExample />
      </ExampleWrapper>
    </main>
  );
}

function CardExample() {
  return (
    <Example title="Card" className="items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>You have 3 unread messages.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p className="text-sm">Configure your notification preferences here.</p>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button>Mark all as read</Button>
          <Button variant="outline">Settings</Button>
        </CardFooter>
      </Card>
    </Example>
  );
}

function BadgeExamples() {
  return (
    <Example title="Badges" className="items-center justify-center">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge>Default</Badge>
        <Badge variant="secondary">Secondary</Badge>
        <Badge variant="outline">Outline</Badge>
        <Badge variant="destructive">Destructive</Badge>
        <Badge>
          <Spinner className="mr-1 h-3 w-3" />
          Loading
        </Badge>
      </div>
    </Example>
  );
}

function ButtonExamples() {
  return (
    <Example title="Buttons & Button Groups">
      <div className="flex w-full flex-col gap-6">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </div>

        <ButtonGroup>
          <Button variant="outline">Option 1</Button>
          <Button variant="outline">Option 2</Button>
          <Button variant="outline">Option 3</Button>
        </ButtonGroup>

        <ButtonGroup>
          <Button variant="outline">Follow</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <ChevronDownIcon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Quick Actions</DropdownMenuLabel>
              <DropdownMenuItem>Mute</DropdownMenuItem>
              <DropdownMenuItem>Block</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive">Report</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ButtonGroup>
      </div>
    </Example>
  );
}

function InputGroupExamples() {
  return (
    <Example title="Input Groups">
      <div className="flex w-full max-w-md flex-col gap-6">
        <InputGroup>
          <InputGroupInput placeholder="Search..." />
          <InputGroupAddon>
            <SearchIcon className="h-4 w-4" />
          </InputGroupAddon>
        </InputGroup>

        <Field>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="your@email.com" />
        </Field>

        <Field>
          <Label htmlFor="role">Role</Label>
          <Select defaultValue="">
            <SelectTrigger id="role">
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="developer">Developer</SelectItem>
                <SelectItem value="designer">Designer</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <Label htmlFor="comments">Comments</Label>
          <Textarea id="comments" placeholder="Add any comments..." />
        </Field>
      </div>
    </Example>
  );
}

function ItemExample() {
  return (
    <Example title="Items">
      <div className="flex w-full max-w-md flex-col gap-4">
        <Item variant="outline">
          <ItemContent>
            <ItemTitle>Two-factor authentication</ItemTitle>
            <ItemDescription>Verify via email or phone number.</ItemDescription>
          </ItemContent>
          <ItemActions>
            <Button size="sm" variant="secondary">
              Enable
            </Button>
          </ItemActions>
        </Item>

        <Item variant="outline" size="sm">
          <ItemContent>
            <ItemTitle>Your order has been shipped</ItemTitle>
            <ItemDescription>Track your package</ItemDescription>
          </ItemContent>
        </Item>
      </div>
    </Example>
  );
}

const SHEET_SIDES = ['top', 'right', 'bottom', 'left'] as const;

function SheetExample() {
  return (
    <Example title="Sheets">
      <div className="flex flex-wrap gap-2">
        {SHEET_SIDES.map((side) => (
          <Sheet key={side}>
            <SheetTrigger asChild>
              <Button variant="secondary" className="capitalize">
                {side}
              </Button>
            </SheetTrigger>
            <SheetContent side={side}>
              <SheetHeader>
                <SheetTitle>Edit profile</SheetTitle>
                <SheetDescription>Make changes to your profile here.</SheetDescription>
              </SheetHeader>
              <div className="py-4">
                <p className="text-muted-foreground text-sm">Content goes here...</p>
              </div>
              <SheetFooter>
                <SheetClose asChild>
                  <Button variant="outline">Cancel</Button>
                </SheetClose>
                <Button type="submit">Save changes</Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
        ))}
      </div>
    </Example>
  );
}

function EmptyExample() {
  return (
    <Example title="Empty States">
      <Empty className="h-full min-h-[300px] border">
        <EmptyHeader>
          <EmptyMedia>
            <div className="flex -space-x-2">
              <Avatar>
                <AvatarImage src="https://github.com/shadcn.png" />
                <AvatarFallback>CN</AvatarFallback>
              </Avatar>
              <Avatar>
                <AvatarImage src="https://github.com/vercel.png" />
                <AvatarFallback>VC</AvatarFallback>
              </Avatar>
            </div>
          </EmptyMedia>
          <EmptyTitle>No Team Members</EmptyTitle>
          <EmptyDescription>Invite your team to collaborate on this project.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button>Show Dialog</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete your account and
                    remove your data from our servers.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction>Continue</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline">Learn More</Button>
          </div>
        </EmptyContent>
      </Empty>
    </Example>
  );
}
