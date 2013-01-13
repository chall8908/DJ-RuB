require 'rubygems'
require 'watir-webdriver'
require 'headless'
require 'yaml'

@running = false
@options = YAML.load_file(File.join(Dir.pwd, "store", "secrets.yml"))
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
    @browser.text_field(id: "Email").set @options["email"]
    @browser.text_field(id: "Passwd").set @options["pass"]
    @browser.button(id: "signIn").click
    @browser.goto 'http://plug.dj/fractionradio/'
  end
  begin
    @browser.execute_script @js
    @js_loaded = true
    @browser.execute_script "RuB.setAuthorizedUsers(#{@options["users"].to_json})"
  rescue Selenium::WebDriver::Error::JavascriptError => e
    p e
  end

  p "setup complete!"
end

def save_song_info(song)
  p song
  File.open(File.join(Dir.pwd, "store", "song.yml"), "w+") { |f| f.write(song.to_yaml) }
end

def save_authorized_users users
  if @options["users"].sort != users.sort
    @options["users"] = users
    File.open(File.join(Dir.pwd, "store", "secrets.yml"), "w+") { |f| f.write(@options.to_yaml) }
  end
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
        save_song_info @browser.execute_script("return RuB.nowPlaying();")
        save_authorized_users @browser.execute_script("return RuB.getAuthorizedUsers();")
      end
      @running = true
    end
  end
end
