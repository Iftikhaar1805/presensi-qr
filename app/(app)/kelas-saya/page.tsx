import Only from '../../../src/components/Only'
import View from '../../../src/views/KelasSayaPage'

export default function Page() {
  return (
    <Only roles={['admin', 'guru']}>
      <View />
    </Only>
  )
}
