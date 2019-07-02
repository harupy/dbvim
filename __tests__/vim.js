import puppeteer from 'puppeteer';
import dotenv from 'dotenv';

dotenv.config();
jest.setTimeout(100000);

const { EMAIL, PASSWORD, CRX_PATH, TEST_NOTEBOOK_URL } = process.env;
const TEST_CODE = `
def func1():
  print('foo')

def func2():
  print('bar')

def func3():
  print('yes')
`.slice(1, -1);

const mirrors = {
  '(': ')',
  ')': '(',
  '{': '}',
  '}': '{',
  '[': ']',
  ']': '[',
  '<': '>',
  '>': '<',
  "'": "'",
  '"': '"',
};

let page;
let browser;

const initCellContent = async () => {
  await page.evaluate(() => {
    document.querySelector('div.CodeMirror').CodeMirror.setValue('');
  });
};

const initCursorPosition = async () => {
  await page.evaluate(() => {
    document.querySelector('div.CodeMirror').CodeMirror.setCursor({ line: 0, ch: 0 });
  });
};

const getValue = async () => {
  return await page.evaluate(() => {
    return document.querySelector('div.CodeMirror').CodeMirror.getValue();
  });
};

const setValue = async value => {
  await page.evaluate(
    ({ value }) => {
      const cm = document.querySelector('div.CodeMirror').CodeMirror;
      cm.setValue(value);
      cm.setCursor({ line: 0, ch: 0 });
    },
    { value },
  );
};

const getCursor = async () => {
  return await page.evaluate(() => {
    return document.querySelector('div.CodeMirror').CodeMirror.getCursor();
  });
};

const getDocumentEnd = async () => {
  return await page.evaluate(() => {
    const cm = document.querySelector('div.CodeMirror').CodeMirror;
    const lastLine = cm.lastLine();
    const lastLineLength = cm.getLine(lastLine).length;
    return { line: lastLine, ch: lastLineLength - 1 };
  });
};

const enterInsertMode = async () => {
  await page.keyboard.press('i');
};

const leaveInsertMode = async () => {
  await page.keyboard.press('Escape');
};

beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: false,
    slowMo: 0,
    args: [
      `--disable-extensions-except=${CRX_PATH}`,
      `--load-extension=${CRX_PATH}`,
      '--user-agent=PuppeteerAgent',
    ],
  });
  page = await browser.newPage();
  await page.goto('https://community.cloud.databricks.com/login.html');
  await page.type('input#login-email', EMAIL);
  await page.type('input#login-password', PASSWORD);
  await page.click('button.signin');
  await page.waitForSelector('h1.welcome-to');
  await page.goto(TEST_NOTEBOOK_URL);
  await page.waitForSelector('div.CodeMirror');
  await page.focus('div.CodeMirror');
  await page.keyboard.press('Enter');
});

beforeEach(async () => {
  await initCellContent();
  await initCursorPosition();
});

afterAll(async () => {
  await initCellContent();
  await initCursorPosition();
  browser.close();
});

expect.extend({
  cursorAt(cursor, line, ch) {
    const pass = (cursor.line === line) & (cursor.ch === ch);
    const posExpected = `(${line}, ${ch})`;
    const posActual = `(${cursor.line}, ${cursor.ch})`;
    if (pass) {
      return {
        pass: true,
        message: () => `expected the cursor not to be at ${posExpected} but it's at ${posActual}`,
      };
    } else {
      return {
        pass: false,
        message: () => `expected the cursor to be at ${posExpected} but it's at ${posActual}`,
      };
    }
  },
});

describe('test', () => {
  it('enter insert mode', async () => {
    await page.keyboard.press('i');
    expect(await getCursor()).cursorAt(0, 0);
    expect(await getValue()).toEqual('');
  });

  it('type characters in insert mode', async () => {
    await page.keyboard.type('abc');
    expect(await getValue()).toEqual('abc');
    expect(await getCursor()).cursorAt(0, 3);
  });

  it('leave insert mode by Escape', async () => {
    await page.keyboard.press('Escape');
    expect(await getValue()).toEqual('');
  });

  it('leave insert mode by jk', async () => {
    await page.keyboard.press('i');
    await page.keyboard.type('jk');
    expect(await getValue()).toEqual('');
  });

  it('move by characters', async () => {
    await setValue('ab\ncde');

    await page.keyboard.type('l');
    expect(await getCursor()).cursorAt(0, 1);

    await page.keyboard.type('h');
    expect(await getCursor()).cursorAt(0, 0);

    await page.keyboard.type('ll');
    expect(await getCursor()).cursorAt(1, 0);

    await page.keyboard.type('h');
    expect(await getCursor()).cursorAt(0, 1);
  });

  it('move by lines', async () => {
    await setValue('ab\ncde');

    await page.keyboard.type('j');
    expect(await getCursor()).cursorAt(1, 0);

    await page.keyboard.type('k');
    expect(await getCursor()).cursorAt(0, 0);

    await page.keyboard.type('jllk');
    expect(await getCursor()).cursorAt(0, 1);
  });

  it('move by words', async () => {
    await setValue(TEST_CODE);

    await page.keyboard.type('e');
    expect(await getCursor()).cursorAt(0, 2);

    await page.keyboard.type('w');
    expect(await getCursor()).cursorAt(0, 4);

    await page.keyboard.type('w');
    expect(await getCursor()).cursorAt(0, 9);

    await page.keyboard.type('w');
    expect(await getCursor()).cursorAt(1, 2);

    await page.keyboard.type('b');
    expect(await getCursor()).cursorAt(0, 9);

    await page.keyboard.type('ee');
    await expect(await getCursor()).cursorAt(1, 6);
  });

  it('move by paragraphs', async () => {
    await setValue(TEST_CODE);

    await page.keyboard.type('}');
    expect(await getCursor()).cursorAt(2, 0);

    await page.keyboard.type('}');
    expect(await getCursor()).cursorAt(5, 0);

    await page.keyboard.type('{');
    expect(await getCursor()).cursorAt(2, 0);

    const docEnd = await getDocumentEnd();
    await page.keyboard.type('}}}');
    expect(await getCursor()).cursorAt(docEnd.line, docEnd.ch);

    await page.keyboard.type('{{{');
    expect(await getCursor()).cursorAt(0, 0);
  });

  it('move to line being and end', async () => {
    await setValue('hello\nworld');
    await page.keyboard.type('$');
    expect(await getCursor()).cursorAt(0, 4);

    // cursor should not move to the next line
    await page.keyboard.type('$');
    expect(await getCursor()).cursorAt(0, 4);

    await page.keyboard.type('^');
    expect(await getCursor()).cursorAt(0, 0);

    // cursor should not move to the previous line
    await page.keyboard.type('j^');
    expect(await getCursor()).cursorAt(1, 0);
  });

  it('delete inner word', async () => {
    await setValue('foo');
    await page.keyboard.type('diw');
    expect(await getValue()).toEqual('');

    await setValue('foo');
    await page.keyboard.type('ediw');
    expect(await getValue()).toEqual('');

    const chars = ['(', ')', '{', '}', '[', ']', "'", '"'];
    for (const char of chars) {
      const pair = [char, mirrors[char]].sort();
      await setValue(pair.join('foo'));
      await page.keyboard.type(`di${char}`);
      expect(await getValue()).toEqual(pair.join(''));
      expect(await getCursor()).cursorAt(0, 1);
    }
  });

  it('delete a word', async () => {
    await setValue('foo');
    await page.keyboard.type('daw');
    expect(await getValue()).toEqual('');

    await setValue('foo bar baz');
    await page.keyboard.type('daw');
    expect(await getValue()).toEqual('bar baz');

    await setValue('foo bar baz');
    await page.keyboard.type('wdaw');
    expect(await getValue()).toEqual('foo baz');

    await setValue('foo bar baz');
    await page.keyboard.type('edaw');
    expect(await getValue()).toEqual('bar baz');

    await setValue('foo bar baz');
    await page.keyboard.type('wedaw');
    expect(await getValue()).toEqual('foo baz');

    await setValue('foo bar baz');
    await page.keyboard.type('wwdaw');
    expect(await getValue()).toEqual('foo bar');

    const chars = ['(', ')', '{', '}', '[', ']', "'", '"'];
    for (const char of chars) {
      const pair = [char, mirrors[char]].sort();
      await setValue(pair.join('foo'));
      await page.keyboard.type(`da${char}`);
      expect(await getValue()).toEqual('');
    }
  });

  it('change inner word', async () => {
    await setValue('foo');
    await page.keyboard.type('ciwa');
    expect(await getValue()).toEqual('a');
    await leaveInsertMode();

    const chars = ['(', ')', '{', '}', '[', ']', "'", '"'];
    for (const char of chars) {
      const pair = [char, mirrors[char]].sort();
      await setValue(pair.join('foo'));
      await page.keyboard.type(`ci${char}`);
      expect(await getCursor()).cursorAt(0, 1);
      await page.keyboard.type('a');
      expect(await getValue()).toEqual(`${pair.join('a')}`);
      await leaveInsertMode();
    }
  });

  it('change a word', async () => {
    await setValue('foo');
    await page.keyboard.type('cawa');
    expect(await getValue()).toEqual('a');
    await leaveInsertMode();

    const chars = ['(', ')', '{', '}', '[', ']', "'", '"'];
    for (const char of chars) {
      const pair = [char, mirrors[char]].sort();
      await setValue(pair.join('foo'));
      await page.keyboard.type(`ca${char}a`);
      expect(await getValue()).toEqual('a');
      await leaveInsertMode();
    }
  });

  it('linewise delete', async () => {
    await setValue('foo');
    await page.keyboard.type('dd');
    expect(await getValue()).toEqual('');
  });

  it('linewise yank and paste', async () => {
    await setValue('foo');
    await page.keyboard.type('yy');
    expect(await getValue()).toEqual('foo');
    expect(await getCursor()).cursorAt(0, 0);
    await page.keyboard.type('p');
    expect(await getValue()).toEqual('foo\nfoo');
  });
});
