import { redirect } from "react-router";

export async function loader() {
    return redirect("/settings/break");
}

export default function HolidaysRedirect() {
    return null;
}
