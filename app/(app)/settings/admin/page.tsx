import UserManagement from "@/components/admin/user-management"

export default async function AdminSettingsPage() {
  const { getUsersAction } = await import("./actions")
  const users = await getUsersAction()

  return (
    <div className="w-full">
      <UserManagement users={users} />
    </div>
  )
}
