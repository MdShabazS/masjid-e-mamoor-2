#!/usr/bin/env python3
"""Render rollback-only psql fixtures for a SQL API that lacks psql meta commands."""

from __future__ import annotations

import pathlib
import re
import sys

VARIABLE = re.compile(r":'([A-Za-z_][A-Za-z_0-9]*)'")
GSET = re.compile(r"\bas\s+([A-Za-z_][A-Za-z_0-9]*)\s*\\gset\s*$", re.I)
SELECT_COLUMN = re.compile(r"^\s*select\s+([A-Za-z_][A-Za-z_0-9]*)\s+from\b", re.I)


def render(source: str) -> str:
    if not re.search(r"^\s*begin\s*;", source, re.I | re.M):
        raise ValueError("fixture must begin a transaction")
    if not re.search(r"^\s*rollback\s*;\s*$", source, re.I | re.M):
        raise ValueError("fixture must roll back")
    if re.search(r"^\s*commit\s*;", source, re.I | re.M):
        raise ValueError("fixture must not commit")

    lines = source.splitlines(keepends=True)
    output: list[str] = []
    captured: set[str] = set()
    cursor = 0
    for end, line in enumerate(lines):
        if "\\gset" not in line:
            continue
        starts = [
            index
            for index in range(cursor, end + 1)
            if re.match(r"^\s*select\b", lines[index], re.I)
        ]
        if not starts:
            raise ValueError("\\gset without a SELECT")
        start = starts[-1]
        statement = "".join(lines[start : end + 1]).strip()
        match = GSET.search(statement)
        if match:
            name = match.group(1)
        else:
            column = SELECT_COLUMN.search(statement)
            if not column or not statement.endswith("\\gset"):
                raise ValueError("\\gset requires a named single-column SELECT")
            name = column.group(1)
        sql = re.sub(r"\s*\\gset\s*$", "", statement)
        if ";" in sql:
            raise ValueError("\\gset SELECT must be one statement")
        output.extend(lines[cursor:start])
        output.append(f"select set_config('connector_fixture.{name}', (\n{sql}\n)::text, true);\n")
        captured.add(name)
        cursor = end + 1
    output.extend(lines[cursor:])
    result = "".join(output)
    referenced = set(VARIABLE.findall(result))
    if referenced - captured:
        raise ValueError(f"unbound psql variables: {', '.join(sorted(referenced - captured))}")
    result = VARIABLE.sub(
        lambda match: f"current_setting('connector_fixture.{match.group(1)}', true)", result
    )
    if "\\gset" in result:
        raise ValueError("untranslated psql command")
    return result


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: connector_fixture_sql.py FIXTURE.sql")
    print(render(pathlib.Path(sys.argv[1]).read_text()), end="")
