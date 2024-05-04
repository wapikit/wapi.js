import type { ApiModel, Excerpt } from '@microsoft/api-extractor-model'
import { ExcerptTokenKind } from '@microsoft/api-extractor-model'
import Link from 'next/link'
import { ItemLink } from '~/components/item-link'
import { resolveItemURI } from '~/reusable-function'

export interface ExcerptTextProps {
	readonly excerpt: Excerpt
	readonly model: ApiModel
}

export function ExcerptText({ model, excerpt }: ExcerptTextProps) {
	console.log({ excerpt })
	return (
		<span>
			{excerpt.spannedTokens.map((token, idx) => {
				console.log({ token })
				if (token.kind === ExcerptTokenKind.Reference) {
					const item = model.resolveDeclarationReference(
						token.canonicalReference!,
						model
					).resolvedApiItem

					console.log({ item })

					if (!item) {
						return token.text
					}

					return (
						<ItemLink
							className="text-primary-500"
							itemURI={resolveItemURI(item)}
							key={`${item.displayName}-${item.containerKey}-${idx}`}
						>
							{token.text}
						</ItemLink>
					)
				}

				return token.text
			})}
		</span>
	)
}
