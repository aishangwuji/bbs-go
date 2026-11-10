import RouterLink, { type PrefetchOption } from "@/lib/router/link"

type AppLinkProps = Omit<React.ComponentProps<typeof RouterLink>, "prefetch"> & {
  prefetch?: boolean | PrefetchOption
}

export default function Link({ prefetch = "intent", ...props }: AppLinkProps) {
  return <RouterLink prefetch={prefetch} {...props} />
}
