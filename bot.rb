require 'rubygems'
require 'pg'
require 'watir-webdriver'
require 'headless'
require 'yaml'

@running = false
@options = YAML.load_file(File.join(Dir.pwd, "secrets.yml"))
js_file = File.open(File.join(Dir.pwd, "plug.js"))
@js = js_file.read
js_file.close
js_file = nil

def setup
  p "setting up..."

  @browser = Watir::Browser.start 'http://plug.dj/fractionradio/'
  google_button = @browser.div(id: "google")
  if google_button.exists?
    google_button.click
    @browser.text_field(id: "Email").set @options.email
    @browser.text_field(id: "Passwd").set @options.pass
    @browser.button(id: "signIn").click
    @browser.goto 'http://plug.dj/fractionradio/'
  end
  begin
    @browser.execute_script(@js)
    @js_loaded = true
  rescue Selenium::WebDriver::Error::JavascriptError => e
    p e
  end

  p "setup complete!"
end

def saveSongInfo(song)
  p song
#  @db_con ||= PG::Connection.new
#  socket = IO.for_fd(@db_con.socket)
#  status = conn.connect_poll
#  #wait for connection to be ready
#  while status != PG::PGRES_POLLING_OK do
#    if(status == PG::PGRES_POLLING_READING)
#      unless select([socket], [], [], 10.0)
#        return
#      end
#    elsif(status == PG::PGRES_POLLING_WRITING)
#      unless select([], [socket], [], 10.0)
#        return
#      end
#    end
#    status = conn.connect_poll
#  end
end

Headless.ly do
  loop do
    setup unless @running
    begin
      @browser.wait_while do
        sill_alive = nil
        begin
          still_alive = @browser.window.exists?

        #this seems kinda hacky, but it works
        rescue
          still_alive = false
        end

        still_alive
      end
      @running = false
    rescue Watir::Wait::TimeoutError
      p "*badum*  Browser operational."
      if @js_loaded
        @browser.execute_script("RuB.heartbeat();")
        saveSongInfo @browser.execute_script("return RuB.nowPlaying();")
      end
      @running = true
    end
  end
end
