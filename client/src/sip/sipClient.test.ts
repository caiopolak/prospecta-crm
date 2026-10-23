import { sipClient } from './sipClient';

describe('SIP configuration handling', () => {
  it('retains the SIP credential only in the in-memory client configuration', () => {
    const password = 'local-test-secret';
    const connect = jest.spyOn(sipClient, 'connect').mockImplementation(() => undefined);

    sipClient.connect({
      is_simulator: 0,
      ws_server: 'wss://sip.example.test/ws',
      sip_domain: 'sip.example.test',
      username: '1001',
      password,
    });

    expect(sipClient.getConfig()?.password).toBe(password);
    connect.mockRestore();
    sipClient.disconnect();
  });
});
