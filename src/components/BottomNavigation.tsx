import { CalendarDays, FolderKanban, House, Settings } from "lucide-react";
import { APP_TAB_LABELS, type AppTab } from "../app/navigation";

interface BottomNavigationProps {
  activeTab: AppTab;
  onChangeTab: (tab: AppTab) => void;
}

const tabs = [
  { tab: "home", icon: House },
  { tab: "records", icon: CalendarDays },
  { tab: "projects", icon: FolderKanban },
  { tab: "settings", icon: Settings },
] as const;

export function BottomNavigation({ activeTab, onChangeTab }: BottomNavigationProps) {
  return (
    <nav className="os-bottom-navigation" aria-label="주요 화면">
      {tabs.map(({ tab, icon: Icon }) => (
        <button
          key={tab}
          type="button"
          className="os-bottom-navigation-item"
          aria-current={activeTab === tab ? "page" : undefined}
          onClick={() => onChangeTab(tab)}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
          <span>{APP_TAB_LABELS[tab]}</span>
        </button>
      ))}
    </nav>
  );
}
