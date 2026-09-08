import React from "react";
import { render, screen } from "@testing-library/react";
import { Drawer } from "@repo/ui/components/ui/drawer";
import { Entity } from "@repo/ui/components/ui/entity";
import { Fieldset } from "@repo/ui/components/ui/fieldset";
import { Tree, Folder, File } from "@repo/ui/components/ui/file-tree";
import { Gauge } from "@repo/ui/components/ui/gauge";
import { Grid, GridCell, GridCross } from "@repo/ui/components/ui/grid";
import { Input, SearchInput } from "@repo/ui/components/ui/input";
import { JsonView } from "@repo/ui/components/ui/json-view";
import { Label } from "@repo/ui/components/ui/label";
import { LoadMoreButton } from "@repo/ui/components/ui/load-more-button";
import { LoadingDots } from "@repo/ui/components/ui/loading-dots";
import {
  Menu,
  MenuButton,
  MenuContainer,
  MenuItem,
  MenuSection,
  MenuItemLocked,
} from "@repo/ui/components/ui/menu";

describe("Geist Batch 4 Components", () => {
  it("renders Drawer correctly", () => {
    render(
      <Drawer show={true} onDismiss={() => {}}>
        Drawer Content
      </Drawer>,
    );
    expect(screen.getByText("Drawer Content")).toBeInTheDocument();
  });

  it("renders Entity correctly", () => {
    render(<Entity title="My Project" description="Production environment" />);
    expect(screen.getByText("My Project")).toBeInTheDocument();
    expect(screen.getByText("Production environment")).toBeInTheDocument();
  });

  it("renders Fieldset correctly", () => {
    render(<Fieldset title="API Keys">Key List</Fieldset>);
    expect(screen.getByText("API Keys")).toBeInTheDocument();
    expect(screen.getByText("Key List")).toBeInTheDocument();
  });

  it("renders File Tree correctly", () => {
    render(
      <Tree>
        <Folder name="src">
          <File name="index.ts" />
        </Folder>
      </Tree>,
    );
    expect(screen.getByText("src")).toBeInTheDocument();
  });

  it("renders Gauge correctly", () => {
    const { container } = render(<Gauge value={50} max={100} />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("renders Grid components correctly", () => {
    render(
      <Grid columns={3}>
        <GridCell columnSpan={2}>Main</GridCell>
        <GridCross />
      </Grid>,
    );
    expect(screen.getByText("Main")).toBeInTheDocument();
  });

  it("renders Input and SearchInput correctly", () => {
    render(<Input placeholder="Text input" />);
    render(<SearchInput placeholder="Search input" />);
    expect(screen.getByPlaceholderText("Text input")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search input")).toBeInTheDocument();
  });

  it("renders JSON View correctly", () => {
    const data = { hello: "world" };
    render(<JsonView value={data} />);
    expect(screen.getByText('"world"')).toBeInTheDocument();
  });

  it("renders Label correctly", () => {
    render(<Label required>Required Label</Label>);
    expect(screen.getByText("Required Label")).toBeInTheDocument();
  });

  it("renders Load More Button correctly", () => {
    render(<LoadMoreButton loading>Fetching</LoadMoreButton>);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders Loading Dots correctly", () => {
    const { container } = render(<LoadingDots />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("renders Menu structure correctly", () => {
    render(
      <MenuContainer>
        <MenuButton>Actions</MenuButton>
        <Menu>
          <MenuSection title="Manage">
            <MenuItem>Edit</MenuItem>
            <MenuItemLocked>Delete</MenuItemLocked>
          </MenuSection>
        </Menu>
      </MenuContainer>,
    );
    expect(screen.getByText("Actions")).toBeInTheDocument();
  });
});
