import { useNavigate } from "react-router";
import { requireAuth } from "~/services/session.service";
import { ErrorView } from "~/components/error-view";
import type { Route } from "./+types/route";

export async function loader({ request }: Route.LoaderArgs) {
    const session = await requireAuth(request);
    return { session };
}

export default function Forbidden() {
    const navigate = useNavigate();
    return (
        <ErrorView
            code="403"
            title="Akses Ditolak"
            message="Role Anda tidak memiliki izin untuk membuka halaman ini. Jika ini merasa salah, hubungi Administrator."
            type="unauthorized"
            actionLabel="Kembali ke Dashboard"
            onAction={() => navigate("/dashboard")}
        />
    );
}
