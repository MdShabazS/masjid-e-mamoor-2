"""Render rollback-only psql fixtures for the hosted SQL runner.

The runner does not interpret psql's ``\\gset`` or ``:'variable'`` syntax. This
converts each captured SELECT row into transaction-local settings and reads
those settings where the original fixture substituted variables.
"""

import re
import sys
from pathlib import Path


def render(source: str) -> str:
    lines = source.splitlines(keepends=True)
    output: list[str] = []
    for line in lines:
        if r"\gset" not in line:
            output.append(line)
            continue
        if line.count(r"\gset") != 1 or not re.search(r"\\gset\s*$", line):
            raise ValueError("unsupported gset line")
        start = (
            len(output)
            if re.match(r"^select\b", line, re.IGNORECASE)
            else next(
                (
                    i
                    for i in range(len(output) - 1, -1, -1)
                    if re.match(r"^select\b", output[i], re.IGNORECASE)
                ),
                None,
            )
        )
        if start is None:
            raise ValueError("gset statement has no top-level SELECT")
        statement = "".join(output[start:]) + line.replace(r"\gset", "")
        if ";" in statement:
            raise ValueError("gset statement has a semicolon")
        output[start:] = [
            "with __fixture_gset as (\n",
            statement.rstrip() + "\n",
            ") select set_config('fixture.' || kv.key, kv.value, true)\n",
            "from __fixture_gset as src cross join lateral\n",
            "jsonb_each_text(to_jsonb(src)) as kv(key, value);\n",
        ]
    result = "".join(output)
    result = re.sub(
        r":'([A-Za-z_][A-Za-z_0-9]*)'",
        lambda match: f"current_setting('fixture.{match.group(1)}', true)",
        result,
    )
    if r"\gset" in result or re.search(r":'[A-Za-z_]", result):
        raise ValueError("unrendered psql substitution")
    return result


if __name__ == "__main__":
    print(render(Path(sys.argv[1]).read_text()), end="")
