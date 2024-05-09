import type { ApiFunction } from '@microsoft/api-extractor-model'
import { Header } from '~/components/header'
import { FunctionBody } from './function-body'

// const OverloadSwitcher = dynamic(async () => import('../../OverloadSwitcher'))

export function Function({ item }: { readonly item: ApiFunction }) {
	const header = (
		<Header kind={item.kind} name={item.name} sourceUrl={item.sourceLocation.fileUrl} />
	)

	if (item.getMergedSiblings().length > 1) {
		// const overloads = item
		// 	.getMergedSiblings()
		// 	.map((sibling, idx) => (
		// 		<FunctionBody item={sibling as ApiFunction} key={`${sibling.displayName}-${idx}`} />
		// 	))

		return (
			<div>
				{header}
				{/* <OverloadSwitcher methodName={item.displayName} overloads={overloads} /> */}
			</div>
		)
	}

	return (
		<div>
			{header}
			<FunctionBody item={item} />
		</div>
	)
}
