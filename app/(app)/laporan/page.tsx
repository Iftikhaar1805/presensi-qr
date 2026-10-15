import Only from '../../../src/components/Only'
import View from '../../../src/views/LaporanPage'

export default function Page() {
  return (
    <Only roles={['admin', 'guru']}>
      <View />
    </Only>
  )
}
