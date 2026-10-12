import { describe, expect, it } from "vitest";
import { applyPairs, changedDims, dimList, filterSpec, filtersWithout, markState, matchesFilters, normalizeFilters, parseFilter } from "../src/components/board/logic";

describe("board: lógica de los filtros cruzados", () => {
  it("lee las marcas: un par, varios, «:» en el valor y comas codificadas", () => {
    expect(parseFilter("tipo:AT")).toEqual([["tipo", "AT"]]);
    expect(parseFilter("area:emp, mes:2026-08")).toEqual([["area", "emp"], ["mes", "2026-08"]]);
    expect(parseFilter("hora:08:00")).toEqual([["hora", "08:00"]]);
    expect(parseFilter("ent:Caja%2C S.A.")).toEqual([["ent", "Caja, S.A."]]);
    expect(parseFilter("sin-dos-puntos,:vacío,x:")).toEqual([]);
    expect(parseFilter("a:1,a:2")).toEqual([["a", "1"]]);
    expect(parseFilter(null)).toEqual([]);
    expect(parseFilter(filterSpec([["ent", "Caja, S.A."], ["p", "100%"]]))).toEqual([["ent", "Caja, S.A."], ["p", "100%"]]);
  });

  it("normaliza lo que llegue", () => {
    expect(normalizeFilters({ tipo: ["AT", "AT", ""], mes: [20, "21"], vacio: [], raro: [{}], uno: "x" })).toEqual({ tipo: ["AT"], mes: ["20", "21"], uno: ["x"] });
    expect(normalizeFilters('{"a":["1"]}')).toEqual({ a: ["1"] });
    expect(normalizeFilters("no es json")).toEqual({});
    expect(normalizeFilters([1, 2])).toEqual({});
  });

  it("un clic deja la dimensión solo con ese valor; otro clic lo quita", () => {
    let r = applyPairs({}, [["tipo", "AT"]]);
    expect(r).toEqual({ filters: { tipo: ["AT"] }, changed: ["tipo"] });
    r = applyPairs({ tipo: ["AT", "EG"] }, [["tipo", "AT"]]);
    expect(r.filters).toEqual({ tipo: ["AT"] });
    r = applyPairs({ tipo: ["AT"], area: ["emp"] }, [["tipo", "AT"]]);
    expect(r).toEqual({ filters: { area: ["emp"] }, changed: ["tipo"] });
  });

  it("sumando, cada par entra o sale", () => {
    let r = applyPairs({ tipo: ["AT"] }, [["tipo", "EG"]], true);
    expect(r.filters).toEqual({ tipo: ["AT", "EG"] });
    r = applyPairs(r.filters, [["tipo", "AT"]], true);
    expect(r.filters).toEqual({ tipo: ["EG"] });
    r = applyPairs(r.filters, [["tipo", "EG"]], true);
    expect(r).toEqual({ filters: {}, changed: ["tipo"] });
  });

  it("una celda con dos pares elige las dos dimensiones y se quita con otro clic", () => {
    const cell: [string, string][] = [["area", "emp"], ["mes", "20"]];
    let r = applyPairs({ tipo: ["AT"], area: ["log"] }, cell);
    expect(r.filters).toEqual({ tipo: ["AT"], area: ["emp"], mes: ["20"] });
    expect(r.changed.sort()).toEqual(["area", "mes"]);
    r = applyPairs(r.filters, cell);
    expect(r.filters).toEqual({ tipo: ["AT"] });
  });

  it("no avisa cambios que no hay", () => {
    expect(applyPairs({ a: ["1"] }, []).changed).toEqual([]);
    expect(changedDims({ a: ["1", "2"] }, { a: ["2", "1"] })).toEqual([]);
    expect(changedDims({ a: ["1"] }, { b: ["1"] }).sort()).toEqual(["a", "b"]);
  });

  it("el estado de una marca: elegida, atenuada o sin tocar", () => {
    const f = { tipo: ["AT"], area: ["emp"] };
    expect(markState(f, [["tipo", "AT"]])).toBe("on");
    expect(markState(f, [["tipo", "EG"]])).toBe("off");
    expect(markState(f, [["mes", "20"]])).toBeNull();
    expect(markState(f, [["area", "emp"], ["mes", "20"]])).toBeNull();
    expect(markState({ ...f, mes: ["20"] }, [["area", "emp"], ["mes", "20"]])).toBe("on");
    expect(markState(f, [["area", "log"], ["mes", "20"]])).toBe("off");
    expect(markState(f, [])).toBeNull();
  });

  it("filtros sin la dimensión del panel, y filas que pasan", () => {
    const f = { tipo: ["AT"], area: ["emp", "log"] };
    expect(filtersWithout(f, "tipo")).toEqual({ area: ["emp", "log"] });
    expect(filtersWithout(f, "tipo area")).toEqual({});
    expect(filtersWithout(f, ["area"])).toEqual({ tipo: ["AT"] });
    expect(dimList("a, b  c")).toEqual(["a", "b", "c"]);
    expect(matchesFilters({ tipo: "AT", area: "emp" }, f)).toBe(true);
    expect(matchesFilters({ tipo: "EG", area: "emp" }, f)).toBe(false);
    expect(matchesFilters({ tipo: "EG", area: "emp" }, f, "tipo")).toBe(true);
    expect(matchesFilters({ tipo: "AT", area: ["adm", "log"] }, f)).toBe(true);
    expect(matchesFilters({ tipo: "AT" }, f)).toBe(false);
    expect(matchesFilters({ mes: 20 }, { mes: ["20"] })).toBe(true);
  });
});
