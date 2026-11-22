using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using System.Windows.Forms;

[assembly: System.Reflection.AssemblyTitle("K.F.C. Chat")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace KfcChat
{
    static class Program
    {
        [STAThread]
        static void Main()
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new ChatForm());
        }
    }

    sealed class ChatForm : Form
    {
        static readonly Color Background = Color.FromArgb(24, 27, 39);
        static readonly Color Side = Color.FromArgb(31, 35, 49);
        static readonly Color Surface = Color.FromArgb(43, 49, 66);
        static readonly Color Mint = Color.FromArgb(169, 245, 212);
        static readonly Color DarkMint = Color.FromArgb(20, 52, 41);
        static readonly Color Ink = Color.FromArgb(241, 243, 251);
        static readonly Color Muted = Color.FromArgb(173, 183, 205);

        readonly Timer poll = new Timer { Interval = 4000 };
        readonly Dictionary<long, string> drafts = new Dictionary<long, string>();
        readonly SortedDictionary<long, ChatMessage> messages = new SortedDictionary<long, ChatMessage>();
        ChatApi api;
        Overview overview;
        Panel loginPanel;
        Panel workspace;
        Label loginStatus;
        Label sidebarTitle;
        Label status;
        Label peerName;
        ListBox people;
        TextBox search;
        TextBox composer;
        Button friendsTab;
        Button chatsTab;
        Button send;
        Button older;
        FlowLayoutPanel bubbles;
        Person peer;
        bool chatTab;
        bool populating;
        bool busy;
        bool polling;
        bool hasOlder;
        int version;
        string pendingText;
        string pendingRequest;
        long pendingPeer;

        public ChatForm()
        {
            Text = "K.F.C. Chat";
            Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
            Font = new Font("Malgun Gothic", 10);
            BackColor = Background;
            ForeColor = Ink;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(940, 650);
            MinimumSize = new Size(720, 500);
            AutoScaleMode = AutoScaleMode.Dpi;
            poll.Tick += async (sender, args) => await Poll();
            FormClosed += (sender, args) => poll.Dispose();
            ShowLogin("");
        }

        static Label LabelText(string text, int size, bool bold, Color color)
        {
            return new Label { Text = text, AutoSize = true, ForeColor = color,
                Font = new Font("Malgun Gothic", size, bold ? FontStyle.Bold : FontStyle.Regular) };
        }

        static Button ButtonText(string text, bool primary)
        {
            var button = new Button { Text = text, FlatStyle = FlatStyle.Flat, TabStop = true,
                BackColor = primary ? Mint : Surface, ForeColor = primary ? DarkMint : Ink,
                Cursor = Cursors.Hand };
            button.FlatAppearance.BorderSize = 0;
            return button;
        }

        static TextBox TextInput(string accessibleName)
        {
            return new TextBox { AccessibleName = accessibleName, BackColor = Surface,
                ForeColor = Ink, BorderStyle = BorderStyle.FixedSingle };
        }

        static void Place(Control parent, Control child, int x, int y, int w, int h)
        {
            child.SetBounds(x, y, w, h);
            parent.Controls.Add(child);
        }

        void ShowLogin(string notice)
        {
            version++;
            poll.Stop();
            if (workspace != null)
            {
                workspace.Dispose();
                workspace = null;
            }
            if (loginPanel != null) loginPanel.Dispose();
            peer = null;
            overview = null;
            drafts.Clear();
            messages.Clear();
            pendingRequest = null;
            busy = false;
            polling = false;

            loginPanel = new Panel { Dock = DockStyle.Fill };
            Controls.Add(loginPanel);
            var card = new Panel { Size = new Size(388, 457), BackColor = Side };
            loginPanel.Controls.Add(card);
            EventHandler center = (sender, args) =>
                card.Location = new Point((loginPanel.Width - card.Width) / 2, (loginPanel.Height - card.Height) / 2);
            loginPanel.Resize += center;
            center(this, EventArgs.Empty);

            Place(card, LabelText("용인시청소년수련관 로봇동아리", 9, true, Mint), 34, 29, 310, 20);
            Place(card, LabelText("K.F.C. Chat", 31, true, Ink), 30, 53, 330, 63);
            Place(card, LabelText("동아리 홈페이지 계정으로 로그인하세요.", 10, false, Muted), 34, 119, 322, 28);
            Place(card, LabelText("동아리 아이디", 10, true, Ink), 34, 161, 320, 25);
            var username = TextInput("동아리 아이디");
            username.MaxLength = 80;
            Place(card, username, 34, 186, 320, 28);
            Place(card, LabelText("비밀번호", 10, true, Ink), 34, 225, 320, 25);
            var password = TextInput("비밀번호");
            password.UseSystemPasswordChar = true;
            password.MaxLength = 128;
            Place(card, password, 34, 250, 320, 28);
            var login = ButtonText("로그인", true);
            Place(card, login, 34, 298, 320, 44);
            loginStatus = LabelText(notice, 9, false, Muted);
            loginStatus.AutoSize = false;
            Place(card, loginStatus, 34, 352, 320, 43);

            var club = new LinkLabel { Text = "동아리 홈페이지 열기 ↗", LinkColor = Mint,
                ActiveLinkColor = Ink, VisitedLinkColor = Mint, AutoSize = true };
            club.LinkClicked += (sender, args) => Process.Start(new ProcessStartInfo
                { FileName = "https://kfc-robot-club.vercel.app/", UseShellExecute = true });
            Place(card, club, 34, 415, 320, 22);
            AcceptButton = login;
            ActiveControl = username;

            login.Click += async (sender, args) =>
            {
                if (String.IsNullOrWhiteSpace(username.Text) || password.Text.Length == 0)
                {
                    loginStatus.Text = "아이디와 비밀번호를 입력해 주세요.";
                    return;
                }

                login.Enabled = false;
                username.ReadOnly = password.ReadOnly = true;
                loginStatus.Text = "로그인 중…";
                var attempt = new ChatApi();
                try
                {
                    await attempt.SignIn(username.Text.Trim(), password.Text);
                    var result = await attempt.GetOverview();
                    if (IsDisposed) return;
                    api = attempt;
                    overview = result;
                    ShowWorkspace();
                }
                catch (ApiError error)
                {
                    if (IsDisposed) return;
                    loginStatus.Text = error.Message;
                    login.Enabled = true;
                    username.ReadOnly = password.ReadOnly = false;
                    password.Clear();
                    password.Focus();
                }
            };
        }

        void ShowWorkspace()
        {
            loginPanel.Dispose();
            loginPanel = null;
            AcceptButton = null;
            chatTab = false;

            workspace = new Panel { Dock = DockStyle.Fill };
            Controls.Add(workspace);
            var sidebar = new Panel { Dock = DockStyle.Left, Width = 284, BackColor = Side };
            var chat = new Panel { Dock = DockStyle.Fill, BackColor = Background };
            workspace.Controls.Add(chat);
            workspace.Controls.Add(sidebar);

            sidebarTitle = LabelText("친구", 23, true, Ink);
            Place(sidebar, sidebarTitle, 20, 20, 183, 42);
            search = TextInput("친구 이름 검색");
            Place(sidebar, search, 20, 75, 244, 30);
            var searchLabel = LabelText("이름 검색", 9, false, Muted);
            Place(sidebar, searchLabel, 20, 55, 244, 18);

            people = new ListBox { AccessibleName = "친구 목록", BorderStyle = BorderStyle.None,
                BackColor = Side, ForeColor = Ink, IntegralHeight = false, DrawMode = DrawMode.OwnerDrawFixed,
                ItemHeight = 58, Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right };
            Place(sidebar, people, 12, 115, 260, 390);
            people.Height = Math.Max(80, sidebar.Height - 209);
            people.DrawItem += DrawPerson;
            people.SelectedIndexChanged += async (sender, args) =>
            {
                if (!populating && people.SelectedItem != null) await OpenPeer(((Row)people.SelectedItem).Person);
            };
            search.TextChanged += (sender, args) => PopulatePeople();

            var navigation = new Panel { Dock = DockStyle.Bottom, Height = 89 };
            sidebar.Controls.Add(navigation);
            navigation.BringToFront();
            friendsTab = ButtonText("친구", true);
            chatsTab = ButtonText("채팅", false);
            Place(navigation, friendsTab, 20, 6, 116, 33);
            Place(navigation, chatsTab, 145, 6, 116, 33);
            Place(navigation, LabelText(overview.self.name, 9, true, Muted), 20, 53, 145, 25);
            var logout = ButtonText("로그아웃", false);
            Place(navigation, logout, 169, 47, 92, 30);
            logout.Click += async (sender, args) =>
            {
                var old = api;
                api = null;
                ShowLogin("로그아웃했습니다.");
                try { await old.SignOut(); } catch (ApiError) { }
            };
            friendsTab.Click += (sender, args) => SwitchTab(false);
            chatsTab.Click += (sender, args) => SwitchTab(true);

            var header = new Panel { Dock = DockStyle.Top, Height = 75, BackColor = Side };
            var footer = new Panel { Dock = DockStyle.Bottom, Height = 107, BackColor = Side };
            bubbles = new FlowLayoutPanel { Dock = DockStyle.Fill, AutoScroll = true,
                FlowDirection = FlowDirection.TopDown, WrapContents = false, Padding = new Padding(15, 10, 15, 10) };
            chat.Controls.Add(bubbles);
            chat.Controls.Add(footer);
            chat.Controls.Add(header);
            peerName = LabelText("대화", 17, true, Ink);
            Place(header, peerName, 20, 12, 345, 32);
            status = LabelText("친구를 선택해 대화를 시작하세요.", 9, false, Muted);
            status.AutoSize = false;
            status.Anchor = AnchorStyles.Top | AnchorStyles.Left | AnchorStyles.Right;
            Place(header, status, 22, 46, Math.Max(100, header.Width - 40), 23);

            composer = TextInput("메시지 입력");
            composer.Multiline = true;
            composer.ScrollBars = ScrollBars.Vertical;
            composer.MaxLength = 2000;
            composer.Anchor = AnchorStyles.Left | AnchorStyles.Top | AnchorStyles.Right;
            Place(footer, composer, 18, 22, Math.Max(100, footer.Width - 121), 61);
            send = ButtonText("보내기", true);
            send.Anchor = AnchorStyles.Right | AnchorStyles.Top;
            Place(footer, send, footer.Width - 87, 22, 69, 61);
            send.Click += async (sender, args) => await Send();
            composer.KeyDown += async (sender, args) =>
            {
                if (args.KeyCode != Keys.Enter || args.Shift || args.Control || args.Alt) return;
                args.SuppressKeyPress = true;
                await Send();
            };
            bubbles.Resize += (sender, args) => ResizeBubbles();

            SetComposer();
            PopulatePeople();
            poll.Start();
        }

        sealed class Row
        {
            public Person Person;
            public string Preview;
        }

        void SwitchTab(bool showChats)
        {
            chatTab = showChats;
            sidebarTitle.Text = showChats ? "채팅" : "친구";
            people.AccessibleName = showChats ? "채팅 목록" : "친구 목록";
            friendsTab.BackColor = showChats ? Surface : Mint;
            friendsTab.ForeColor = showChats ? Ink : DarkMint;
            chatsTab.BackColor = showChats ? Mint : Surface;
            chatsTab.ForeColor = showChats ? DarkMint : Ink;
            PopulatePeople();
        }

        void PopulatePeople()
        {
            if (overview == null) return;
            var friends = overview.friends.Where(p =>
                p.name.IndexOf(search.Text.Trim(), StringComparison.CurrentCultureIgnoreCase) >= 0);
            IEnumerable<Row> rows;
            if (chatTab)
            {
                var available = friends.ToDictionary(p => p.id);
                rows = overview.chats.Where(t => available.ContainsKey(t.peer_id)).Select(t =>
                    new Row { Person = available[t.peer_id], Preview = t.content });
            }
            else
            {
                rows = friends.Select(p => new Row { Person = p });
            }
            var items = rows.ToArray();
            var existing = people.Items.Cast<Row>().ToArray();
            if (items.Length == existing.Length && items.Zip(existing, (a, b) =>
                a.Person.id == b.Person.id && a.Person.name == b.Person.name && a.Preview == b.Preview).All(equal => equal))
                return;
            int top = people.TopIndex;
            populating = true;
            people.BeginUpdate();
            people.Items.Clear();
            people.Items.AddRange(items);
            people.SelectedIndex = Array.FindIndex(items, item => peer != null && item.Person.id == peer.id);
            if (items.Length > 0 && top >= 0) people.TopIndex = Math.Min(top, items.Length - 1);
            people.EndUpdate();
            populating = false;
        }

        void DrawPerson(object sender, DrawItemEventArgs args)
        {
            if (args.Index < 0) return;
            var row = (Row)people.Items[args.Index];
            bool selected = (args.State & DrawItemState.Selected) != 0;
            using (var brush = new SolidBrush(selected ? Color.FromArgb(48, 69, 70) : Side))
                args.Graphics.FillRectangle(brush, args.Bounds);
            var circle = new Rectangle(args.Bounds.X + 9, args.Bounds.Y + 10, 37, 37);
            using (var brush = new SolidBrush(DarkMint)) args.Graphics.FillEllipse(brush, circle);
            TextRenderer.DrawText(args.Graphics, StringInfoFirst(row.Person.name), Font, circle, Mint,
                TextFormatFlags.VerticalCenter | TextFormatFlags.HorizontalCenter | TextFormatFlags.NoPrefix);
            var nameBounds = new Rectangle(args.Bounds.X + 57, args.Bounds.Y + (row.Preview == null ? 17 : 8), args.Bounds.Width - 66, 22);
            TextRenderer.DrawText(args.Graphics, row.Person.name, Font, nameBounds, Ink,
                TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix);
            if (row.Preview != null)
            {
                nameBounds.Y += 23;
                TextRenderer.DrawText(args.Graphics, row.Preview.Replace("\r", " ").Replace("\n", " "), Font,
                    nameBounds, Muted, TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine | TextFormatFlags.NoPrefix);
            }
            args.DrawFocusRectangle();
        }

        static string StringInfoFirst(string value)
        {
            return String.IsNullOrWhiteSpace(value) ? "K" :
                System.Globalization.StringInfo.GetNextTextElement(value.Trim());
        }

        async Task OpenPeer(Person target)
        {
            if (peer != null && peer.id == target.id) return;
            if (peer != null) drafts[peer.id] = composer.Text;
            peer = target;
            version++;
            messages.Clear();
            hasOlder = false;
            peerName.Text = target.name;
            status.Text = "대화를 불러오는 중…";
            string draft;
            composer.Text = drafts.TryGetValue(target.id, out draft) ? draft : "";
            SetComposer();
            Render(false);
            composer.Focus();
            await RefreshHistory(api, target.id, version, false);
        }

        async Task Poll()
        {
            if (polling || api == null || IsDisposed) return;
            polling = true;
            var active = api;
            try
            {
                var result = await active.GetOverview();
                if (api != active || IsDisposed) return;
                overview = result;
                if (peer != null && !result.friends.Any(p => p.id == peer.id))
                {
                    peer = null;
                    messages.Clear();
                    hasOlder = false;
                    version++;
                    peerName.Text = "대화";
                    status.Text = "선택한 친구는 현재 채팅을 이용할 수 없습니다.";
                    composer.Clear();
                    SetComposer();
                    Render(false);
                }
                PopulatePeople();
                if (peer != null)
                {
                    var latest = result.chats.FirstOrDefault(t => t.peer_id == peer.id);
                    if (latest != null && !messages.ContainsKey(latest.last_id))
                        await RefreshHistory(active, peer.id, version, false);
                    else if (api == active) status.Text = messages.Count == 0 ? "첫 메시지를 보내 보세요." : "연결됨";
                }
                else if (api == active) status.Text = "친구를 선택해 대화를 시작하세요.";
            }
            catch (ApiError error) { Report(active, error); }
            finally { if (api == active) polling = false; }
        }

        async Task RefreshHistory(ChatApi active, long id, int view, bool previous)
        {
            try
            {
                var history = await active.GetHistory(id, previous && messages.Count > 0 ? messages.Keys.First() : 0);
                if (api != active || version != view || IsDisposed) return;
                bool initial = messages.Count == 0;
                bool changed = history.messages.Any(message => !messages.ContainsKey(message.id));
                if (!previous && history.older && !initial && !history.messages.Any(message => messages.ContainsKey(message.id)))
                {
                    messages.Clear();
                    initial = true;
                }
                foreach (var message in history.messages) messages[message.id] = message;
                if (initial || previous) hasOlder = history.older;
                if (changed || initial || previous) Render(previous);
                status.Text = messages.Count == 0 ? "첫 메시지를 보내 보세요." : "연결됨";
            }
            catch (ApiError error)
            {
                if (api == active && version == view) Report(active, error);
            }
        }

        async Task Send()
        {
            if (busy || peer == null || String.IsNullOrWhiteSpace(composer.Text)) return;
            long id = peer.id;
            int view = version;
            var active = api;
            var body = composer.Text.Trim();
            if (pendingRequest == null || pendingPeer != id || pendingText != body)
            {
                pendingPeer = id;
                pendingText = body;
                pendingRequest = Guid.NewGuid().ToString();
            }
            var request = pendingRequest;
            busy = true;
            SetComposer();
            try
            {
                await active.Send(id, body, request);
                if (api != active || IsDisposed) return;
                pendingRequest = null;
                drafts.Remove(id);
                if (version == view)
                {
                    composer.Clear();
                    await RefreshHistory(active, id, view, false);
                }
                else if (peer != null && peer.id == id && composer.Text.Trim() == body)
                {
                    composer.Clear();
                }
                await Poll();
            }
            catch (ApiError error) { Report(active, error); }
            finally
            {
                if (api == active && !IsDisposed)
                {
                    busy = false;
                    SetComposer();
                    if (version == view) composer.Focus();
                }
            }
        }

        void Report(ChatApi active, ApiError error)
        {
            if (api != active || IsDisposed) return;
            if (error.Status == 401 || error.Status == 403)
            {
                api = null;
                ShowLogin(error.Message);
            }
            else { status.Text = error.Message; }
        }

        void SetComposer()
        {
            composer.Enabled = peer != null;
            composer.ReadOnly = busy;
            send.Enabled = peer != null && !busy;
        }

        void Render(bool preserve)
        {
            var oldHeight = bubbles.DisplayRectangle.Height;
            var oldPosition = -bubbles.AutoScrollPosition.Y;
            bubbles.SuspendLayout();
            while (bubbles.Controls.Count > 0) bubbles.Controls[0].Dispose();
            older = null;
            if (hasOlder)
            {
                older = ButtonText("이전 메시지", false);
                older.Size = new Size(125, 32);
                older.Click += async (sender, args) =>
                {
                    var button = (Button)sender;
                    button.Enabled = false;
                    await RefreshHistory(api, peer.id, version, true);
                    if (!button.IsDisposed) button.Enabled = true;
                };
                bubbles.Controls.Add(older);
            }
            foreach (var message in messages.Values)
            {
                bool mine = message.sender_id == overview.self.id;
                var row = new Panel { Margin = new Padding(0, 3, 0, 5), Tag = mine };
                var text = LabelText(message.content, 10, false, mine ? DarkMint : Ink);
                text.UseMnemonic = false;
                text.Padding = new Padding(10, 7, 10, 7);
                text.BackColor = mine ? Mint : Surface;
                var timestamp = LabelText(FormatTime(message.created_at), 8, false, Muted);
                row.Controls.Add(text);
                row.Controls.Add(timestamp);
                bubbles.Controls.Add(row);
            }
            ResizeBubbles();
            bubbles.ResumeLayout(true);
            if (preserve)
                bubbles.AutoScrollPosition = new Point(0, Math.Max(0, oldPosition + bubbles.DisplayRectangle.Height - oldHeight));
            else if (bubbles.Controls.Count > 0)
                bubbles.ScrollControlIntoView(bubbles.Controls[bubbles.Controls.Count - 1]);
        }

        void ResizeBubbles()
        {
            if (bubbles == null || bubbles.IsDisposed) return;
            int width = Math.Max(180, bubbles.ClientSize.Width - 52);
            foreach (Control row in bubbles.Controls)
            {
                if (!(row.Tag is bool)) continue;
                bool mine = (bool)row.Tag;
                var text = (Label)row.Controls[0];
                var time = (Label)row.Controls[1];
                text.MaximumSize = new Size(Math.Max(120, width * 74 / 100), 0);
                row.Size = new Size(width, text.PreferredHeight + time.PreferredHeight + 4);
                text.Location = new Point(mine ? width - text.PreferredWidth : 0, 0);
                time.Location = new Point(mine ? width - time.PreferredWidth : 0, text.PreferredHeight + 3);
            }
        }

        static string FormatTime(string value)
        {
            DateTimeOffset time;
            return DateTimeOffset.TryParse(value, out time) ? time.ToLocalTime().ToString("M/d HH:mm") : "";
        }
    }
}
