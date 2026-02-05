import { listRegions } from "@lib/data/regions"
import { listLocales } from "@lib/data/locales"
import { getLocale } from "@lib/data/locale-actions"
import { StoreRegion } from "@medusajs/types"
import SideMenu from "@modules/layout/components/side-menu"

export default async function SideMenuWrapper() {
    const [regions, locales, currentLocale] = await Promise.all([
        listRegions().then((regions: StoreRegion[]) => regions),
        listLocales(),
        getLocale(),
    ])

    return <SideMenu regions={regions} locales={locales} currentLocale={currentLocale} />
}
