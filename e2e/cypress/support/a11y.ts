import "cypress-axe"
import type { Result } from "axe-core"

const BLOCKING_IMPACTS = ["serious", "critical"]

function printViolations(violations: Result[]) {
    const lines = violations.flatMap((violation) =>
        violation.nodes.map(
            (node) =>
                `  [${violation.impact}] ${violation.id} on ${node.target.join(" ")}: ${violation.help}\n` +
                `    ${node.html.slice(0, 200)}\n    ${(node.failureSummary ?? "").replace(/\s+/g, " ").slice(0, 300)}`,
        ),
    )
    cy.url({ log: false }).then((url) =>
        cy.task("logStep", `axe: ${violations.length} violation(s) on ${url}\n${lines.join("\n")}`, { log: false }),
    )
}

Cypress.Commands.add("assertAccessible", (options: Cypress.AssertAccessibleOptions = {}) => {
    cy.injectAxe()
    cy.checkA11y(
        options.context,
        options.rules
            ? { runOnly: { type: "rule", values: options.rules } }
            : { includedImpacts: BLOCKING_IMPACTS },
        printViolations,
    )
})
