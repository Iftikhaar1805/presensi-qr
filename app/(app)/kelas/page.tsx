import Only from '../../../src/components/Only'
import { KelasPage as View } from '../../../src/views/GuruKelasPage'

export default function Page() {
  return (
    <Only roles={['admin']}>
      <View />
    </Only>
  )
}
