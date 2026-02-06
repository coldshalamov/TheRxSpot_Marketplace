import SideMenu from "@modules/layout/components/side-menu"

export default function SideMenuWrapper() {
  // Avoid calling server actions during initial render in Next 15/Turbopack.
  // Side menu still renders and locale/country selectors are hidden until
  // we re-introduce a non-action data loader.
  return <SideMenu regions={null} locales={null} currentLocale={null} />
}
