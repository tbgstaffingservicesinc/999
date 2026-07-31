import UserNav from "./user-nav";

export default function Header() {
  return (
    <header className="flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200">
      <div>
        {/* Add any header content here, like a search bar */}
      </div>
      <div className="flex items-center gap-4">
        <span className="px-2 py-1 text-sm font-semibold text-white bg-red-500 rounded-full">
          MOCK
        </span>
        <UserNav />
      </div>
    </header>
  );
}
