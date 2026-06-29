import { getPayload } from "payload";
import config from "../payload.config";

async function setup() {
  const payload = await getPayload({ config });

  // Create admin user
  const user = await payload.create({
    collection: "users",
    data: {
      email: "admin@plantcor.com",
      password: "Admin@123#",
    },
  });

  console.log("Admin user created:", user.email);

  // Create initial departments
  const departments = [
    {
      name: "drilling",
      displayName: "Drilling",
      description: "Drill rig operations",
    },
    {
      name: "production",
      displayName: "Production",
      description: "Coal yield tracking",
    },
    {
      name: "control-room",
      displayName: "Control Room",
      description: "Real-time monitoring",
    },
  ];

  for (const dept of departments) {
    await payload.create({
      collection: "departments",
      data: dept,
    });
    console.log("Created department:", dept.name);
  }

  process.exit(0);
}

setup().catch((err) => {
  console.error(err);
  process.exit(1);
});
