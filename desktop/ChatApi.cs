using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

namespace KfcChat
{
    sealed class ApiError : Exception
    {
        public readonly int Status;
        public ApiError(int status, string message) : base(message) { Status = status; }
    }

    sealed class Person
    {
        public Person() { }
        public long id { get; set; }
        public string name { get; set; }
    }

    sealed class ThreadSummary
    {
        public ThreadSummary() { }
        public long peer_id { get; set; }
        public long last_id { get; set; }
        public string content { get; set; }
    }

    sealed class Overview
    {
        public Overview() { }
        public Person self { get; set; }
        public Person[] friends { get; set; }
        public ThreadSummary[] chats { get; set; }
    }

    sealed class ChatMessage
    {
        public ChatMessage() { }
        public long id { get; set; }
        public long sender_id { get; set; }
        public string content { get; set; }
        public string created_at { get; set; }
    }

    sealed class History
    {
        public History() { }
        public ChatMessage[] messages { get; set; }
        public bool older { get; set; }
    }

    sealed class Session
    {
        public Session() { }
        public string access_token { get; set; }
        public string refresh_token { get; set; }
    }

    sealed class LoginResponse
    {
        public LoginResponse() { }
        public Session session { get; set; }
    }

    sealed class ChatApi
    {
        const string Server = "https://mzlqksaprteljlcjnxix.supabase.co";
        const string PublicKey = "sb_publishable_b2sm_UXIVP_3OUqzlAQJ6w_LM-RQsTf";
        const string DesktopApi = "/functions/v1/kfc-chat-desktop";
        static readonly HttpClient Http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        {
            BaseAddress = new Uri(Server),
            Timeout = TimeSpan.FromSeconds(15)
        };

        readonly SemaphoreSlim refreshLock = new SemaphoreSlim(1, 1);
        Session session;

        public async Task SignIn(string username, string password)
        {
            var login = await Post<LoginResponse>("/functions/v1/kfc-api/auth/login", new { username, password }, null);
            if (login == null || login.session == null || String.IsNullOrEmpty(login.session.access_token))
                throw new ApiError(401, "로그인 응답을 확인할 수 없습니다.");
            session = login.session;
        }

        public async Task SignOut()
        {
            var current = session;
            session = null;
            if (current != null)
                await Post<object>("/auth/v1/logout?scope=local", new { }, current.access_token);
        }

        public Task<Overview> GetOverview() { return Request<Overview>(new { action = "overview" }); }
        public Task<History> GetHistory(long peer, long before)
        {
            return Request<History>(new { action = "history", peer, before });
        }
        public Task<object> Send(long peer, string content, string requestId)
        {
            return Request<object>(new { action = "send", peer, content, requestId });
        }

        async Task<T> Request<T>(object input)
        {
            var current = session;
            if (current == null) throw new ApiError(401, "다시 로그인해 주세요.");
            try
            {
                return await Post<T>(DesktopApi, input, current.access_token);
            }
            catch (ApiError error)
            {
                if (error.Status != 401) throw;
            }

            await refreshLock.WaitAsync();
            try
            {
                if (session == null) throw new ApiError(401, "다시 로그인해 주세요.");
                if (ReferenceEquals(session, current))
                {
                    var refreshed = await Post<Session>("/auth/v1/token?grant_type=refresh_token",
                        new { refresh_token = current.refresh_token }, null);
                    if (session == null || refreshed == null || String.IsNullOrEmpty(refreshed.access_token))
                        throw new ApiError(401, "다시 로그인해 주세요.");
                    session = refreshed;
                }
                current = session;
            }
            finally { refreshLock.Release(); }
            return await Post<T>(DesktopApi, input, current.access_token);
        }

        static async Task<T> Post<T>(string route, object body, string token)
        {
            var json = new JavaScriptSerializer();
            using (var request = new HttpRequestMessage(HttpMethod.Post, route))
            {
                request.Headers.Add("apikey", PublicKey);
                if (token != null) request.Headers.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
                request.Content = new StringContent(json.Serialize(body), Encoding.UTF8, "application/json");

                try
                {
                    using (var response = await Http.SendAsync(request))
                    {
                        var payload = await response.Content.ReadAsStringAsync();
                        if (!response.IsSuccessStatusCode)
                        {
                            int status = (int)response.StatusCode;
                            string message = null;
                            try
                            {
                                var error = json.Deserialize<Dictionary<string, object>>(payload);
                                object value;
                                if (error != null && error.TryGetValue("message", out value)) message = value as string;
                            }
                            catch (ArgumentException) { }
                            if (route.StartsWith("/auth/v1/token") && status < 500 && status != 429)
                                throw new ApiError(401, "로그인 시간이 만료되었습니다. 다시 로그인해 주세요.");
                            throw new ApiError(status, message ?? "서버 응답을 확인할 수 없습니다.");
                        }
                        return String.IsNullOrWhiteSpace(payload) ? default(T) : json.Deserialize<T>(payload);
                    }
                }
                catch (HttpRequestException) { throw new ApiError(0, "인터넷 연결을 확인하고 다시 시도해 주세요."); }
                catch (TaskCanceledException) { throw new ApiError(0, "서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요."); }
            }
        }
    }
}
