import Only from '../../../src/components/Only'
import { BantuanPage as View } from '../../../src/views/ProfilBantuanPage'

export default function Page() {
  return (
    <Only roles={['admin', 'guru']}>
      <View />
    </Only>
  )
}
