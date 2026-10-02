import { RECORD_SECTION_LABELS, type RecordSection } from "../app/navigation";

interface RecordNavigationProps {
  activeSection: RecordSection;
  onChangeSection: (section: RecordSection) => void;
}

const sections: RecordSection[] = ["all", "memo", "tasks", "fitness"];

export function RecordNavigation({ activeSection, onChangeSection }: RecordNavigationProps) {
  return (
    <nav className="os-record-navigation" aria-label="기록 분류">
      {sections.map((section) => (
        <button
          key={section}
          type="button"
          aria-current={activeSection === section ? "page" : undefined}
          aria-controls={`records-${section}`}
          onClick={() => onChangeSection(section)}
        >
          {RECORD_SECTION_LABELS[section]}
        </button>
      ))}
    </nav>
  );
}
