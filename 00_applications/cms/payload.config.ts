import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { buildConfig } from "payload";
import path from "path";
import { fileURLToPath } from "url";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

export default buildConfig({
  admin: {
    user: "users",
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [
    {
      slug: "users",
      auth: true,
      fields: [],
    },
    {
      slug: "departments",
      admin: {
        useAsTitle: "name",
      },
      fields: [
        {
          name: "name",
          type: "text",
          required: true,
          unique: true,
        },
        {
          name: "displayName",
          type: "text",
          required: true,
        },
        {
          name: "description",
          type: "textarea",
        },
      ],
    },
    {
      slug: "documents",
      admin: {
        useAsTitle: "title",
      },
      fields: [
        {
          name: "title",
          type: "text",
          required: true,
        },
        {
          name: "department",
          type: "relationship",
          relationTo: "departments",
          required: true,
        },
        {
          name: "content",
          type: "richText",
          required: true,
        },
        {
          name: "status",
          type: "select",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Published", value: "published" },
            { label: "Archived", value: "archived" },
          ],
          defaultValue: "draft",
        },
      ],
    },
  ],
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || "",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "",
    },
  }),
});
