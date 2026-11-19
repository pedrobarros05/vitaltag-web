import { expect, test } from "./fixtures";
import { createUser, section, signIn } from "./support";

test.describe("Profile", () => {
  test("a new user fills in and saves the clinical profile", async ({ page, request }) => {
    const user = await createUser(request);
    await signIn(page, user.email, user.password);

    await page.getByRole("link", { name: "Set up profile" }).click();
    await expect(page.getByRole("heading", { name: "Clinical Profile" })).toBeVisible();

    await page.getByLabel("First name", { exact: true }).fill("Maria");
    await page.getByLabel("Last name", { exact: true }).fill("Silva");
    await page.getByLabel("Date of birth", { exact: true }).fill("1990-01-02");
    await page.getByLabel("Blood type", { exact: true }).selectOption("AB+");
    await page.getByLabel("Public password (for emergency access)", { exact: true }).fill("4321");

    const contacts = section(page, "Emergency Contacts");
    await contacts.getByRole("button", { name: "+ Add" }).click();
    await contacts.getByLabel("Name", { exact: true }).fill("João Silva");
    await contacts.getByLabel("Phone", { exact: true }).fill("(11) 98765-4321");
    await contacts.getByLabel("Relationship", { exact: true }).fill("Spouse");

    const allergies = section(page, "Allergies");
    await allergies.getByRole("button", { name: "+ Add" }).click();
    await allergies.getByLabel("Description", { exact: true }).fill("Dipyrone");
    await allergies.getByLabel("Severity", { exact: true }).selectOption("severe");

    // The browser must send the API's Portuguese wire format
    const saveRequest = page.waitForRequest(
      (r) => r.method() === "POST" && r.url().endsWith("/api/v1/perfil")
    );
    await page.getByRole("button", { name: "Save profile" }).click();

    const body = (await saveRequest).postDataJSON();
    expect(body).toMatchObject({
      nome: "Maria",
      sobrenome: "Silva",
      data_nascimento: "1990-01-02",
      tipo_sanguineo: "AB+",
      senha_publica: "4321",
      contatos_emergencia: [{ nome: "João Silva", telefone: "(11) 98765-4321", parentesco: "Spouse" }],
      alergias: [{ descricao: "Dipyrone", gravidade: "grave" }],
    });
    await expect(page.getByText("Profile saved successfully!")).toBeVisible();

    // Persisted: a reload shows the saved values (and never the public password)
    await page.reload();
    await expect(page.getByLabel("First name", { exact: true })).toHaveValue("Maria");
    await expect(page.getByLabel("Blood type", { exact: true })).toHaveValue("AB+");
    await expect(page.getByLabel("Public password (for emergency access)", { exact: true })).toHaveValue("");
    await expect(section(page, "Allergies").getByLabel("Description", { exact: true })).toHaveValue("Dipyrone");
    await expect(section(page, "Allergies").getByLabel("Severity", { exact: true })).toHaveValue("severe");
    await expect(section(page, "Emergency Contacts").getByLabel("Phone", { exact: true })).toHaveValue("(11) 98765-4321");

    // The dashboard now shows the summary
    await page.getByRole("link", { name: "← Back" }).click();
    await expect(page.getByRole("heading", { name: "Hi, Maria! 👋" })).toBeVisible();
    await expect(page.getByText("Maria Silva")).toBeVisible();
    await expect(page.getByText("AB+")).toBeVisible();
  });

  test("the first save requires a public password (API validation is shown)", async ({ page, request }) => {
    const user = await createUser(request);
    await signIn(page, user.email, user.password);
    await page.goto("/profile");

    await page.getByLabel("First name", { exact: true }).fill("Maria");
    await page.getByLabel("Last name", { exact: true }).fill("Silva");
    await page.getByLabel("Date of birth", { exact: true }).fill("1990-01-02");
    await page.getByLabel("Blood type", { exact: true }).selectOption("O+");
    await page.getByRole("button", { name: "Save profile" }).click();

    await expect(page.getByText("set a public password when creating your profile")).toBeVisible();
  });
});
