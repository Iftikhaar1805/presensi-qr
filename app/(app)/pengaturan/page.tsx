import Only from '../../../src/components/Only'
import View from '../../../src/views/PengaturanPage'

export default function Page() {
  return (
    <Only roles={['admin']}>
      <View />
    </Only>
  )
}
