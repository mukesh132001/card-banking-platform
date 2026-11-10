/**
 * The main customer journey, end to end against the real API:
 * open a protected page -> sent to login -> log in -> accounts -> transactions -> search.
 * Uses the demo data that account-service loads at startup.
 */
describe('Customer journey: login -> transactions', () => {
  it('logs in, opens an account and searches its transactions', () => {
    // Route guard: a signed-out visit to a customer page goes to /login and remembers the page.
    cy.visit('/accounts');
    cy.location('pathname').should('eq', '/login');
    cy.location('search').should('contain', 'returnUrl=%2Faccounts');

    // Wrong password -> clear message, no navigation.
    cy.get('#email').type('alex.morgan@example.com');
    cy.get('#password').type('not-the-password');
    cy.contains('button', 'Log in').click();
    cy.get('[role="alert"]').should('contain', 'Invalid email or password');
    cy.location('pathname').should('eq', '/login');

    // Right password -> accounts dashboard, with masked numbers and exact balances.
    cy.intercept('POST', '/api/auth/login').as('login');
    cy.get('#password').type('alex-demo-password');
    cy.contains('button', 'Log in').click();
    cy.wait('@login').its('response.statusCode').should('eq', 200);
    cy.location('pathname').should('eq', '/accounts');
    cy.get('li.account').should('have.length', 2);
    cy.get('li.account').first().should('contain', '1234').and('contain', '£5,309.01');
    cy.get('.total').should('contain', '£18,393.01');

    // The access token is never written to storage (it lives in memory only).
    cy.window().then((win) => {
      const stored = [...Object.values(win.localStorage), ...Object.values(win.sessionStorage)].join(' ');
      expect(stored).not.to.match(/^eyJ|\seyJ/); // JWTs start with "eyJ"
    });

    // Transactions: server-side paging, then a debounced search.
    cy.intercept('GET', '/api/accounts/*/transactions*').as('transactions');
    cy.get('li.account').first().find('a').click();
    cy.location('pathname').should('match', /^\/accounts\/\d+$/);
    cy.wait('@transactions');
    cy.get('h1').should('contain', 'Current account');
    cy.get('table.transactions tbody tr').should('have.length.at.least', 1);
    cy.get('.pager').should('contain', 'Page 1 of');

    cy.get('#q').type('tesco');
    // One request for the whole word, not one per letter.
    cy.wait('@transactions').its('request.url').should('contain', 'q=tesco');
    cy.get('table.transactions tbody tr').each((row) => cy.wrap(row).should('contain.text', 'Tesco'));

    cy.get('#direction').select('Money in');
    cy.wait('@transactions').its('request.url').should('contain', 'direction=CREDIT');

    // Customers can't open the back office: the role guard sends them home.
    cy.visit('/admin');
    cy.location('pathname').should('eq', '/accounts');
  });
});
