const loadModule = async () => import("../repositories/sync-query-builders.repository.js");

describe("SyncService view column lists", () => {
  test("hrms_employees columns are explicit", async () => {
    const mod = await loadModule();
    const cols = (mod as any).VIEW_EMPLOYEE_COLUMNS ?? null;

    expect(cols).toEqual([
      "citizen_id",
      "title",
      "first_name",
      "last_name",
      "sex",
      "birth_date",
      "position_name",
      "position_number",
      "level",
      "special_position",
      "employee_type",
      "start_current_position",
      "first_entry_date",
      "mission_group",
      "department",
      "sub_department",
      "specialist",
      "expert",
      "original_status",
      "is_currently_active",
    ]);
  });

  test("hrms_support_staff columns are explicit", async () => {
    const mod = await loadModule();
    const cols = (mod as any).VIEW_SUPPORT_COLUMNS ?? null;

    expect(cols).toEqual([
      "citizen_id",
      "title",
      "first_name",
      "last_name",
      "sex",
      "position_name",
      "position_number",
      "level",
      "special_position",
      "employee_type",
      "start_current_position",
      "first_entry_date",
      "mission_group",
      "department",
      "original_status",
      "is_currently_active",
    ]);
  });

});
