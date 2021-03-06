;(function($) {
  
  $.easing.def = 'easeInOutCubic';
  
  var dbname = window.location.pathname.split('/')[1];
  var db     = $.couch.db(dbname); 
  
  var default_slide_scale = {width: 1280, height: 650};
  
  function windowDimensions() {
    return {
      width: $(window).width(),
      height: $(window).height()
    };
  };
  
  function preloadImages() {
    var d=document; 
    Sammy.log('preloadImages', arguments);
    if(d.images){ 
      if(!d.MM_p) d.MM_p=new Array();
      var i,j=d.MM_p.length,a=arguments; 
      for(i=0; i<a.length; i++) {
        if (a[i].indexOf("#")!=0) { 
          d.MM_p[j]=new Image; 
          d.MM_p[j++].src=a[i];
        }
      }
    }
  };
  
  Preso = function(doc) {
    var default_doc = {
      name: "",
      slides: [],
      type: "presentation" 
    };
    this.database   = db;
    this.attributes = $.extend({}, default_doc, doc);
  };
  
  Preso.default_callbacks = {
    success: function(resp) {
      Sammy.log('default success', resp);
    },
    error: function(resp) {
      Sammy.log('default error', resp);
    }
  };
    
  Preso.mergeCallbacks = function(callbacks) {
    return $.extend({}, Preso.default_callbacks, callbacks);
  };
  
  Preso.find = function(id, success) {
    db.openDoc(id, Preso.mergeCallbacks({
      success: function(resp) {
        var p = new Preso(resp);
        success.apply(p, [p]);
      }
    }));
  };
  
  Preso.all = function(success) {
    db.view('swinger/presos', Preso.mergeCallbacks({
      success: function(resp) {
        var presos = [];
        $.each(resp.rows, function(k, v) {
          presos.push(new Preso(v.value));
        });
        success(presos);
      }
    }));
  };
  
  $.extend(Preso.prototype, new Sammy.Object, {
    id: function() {
      return this.attributes['_id'];
    },
    uri: function() {
      return [this.database.uri, this.id()].join('');
    },
    reload: function(callback) {
      var preso = this;
      Preso.find(this.id(), function(p) {
        $.extend(preso.attributes, p.attributes);
        callback.apply(this, [preso]);
      });
    },
    save: function(callback) {
      var self = this;
      this.database.saveDoc(this.attributes, Preso.mergeCallbacks({
        success: function(resp) {
          Sammy.log('preso.save', self, resp);
          $.extend(self.attributes, resp);
          if (callback) { callback.apply(self, [resp]); }
        }
      }));
    },
    slide: function(num, update) {
      var s;
      num = parseInt(num) - 1;
      if (this.attributes.slides[num]) {
        s = this.attributes.slides[num];
      } else {
        s = {
          content_html: "",
          content: "",
          transition: "",
          theme: 'basic',
          additional_css: "",
          position: num + 1
        };
      }
      if (typeof update != 'undefined') {
        // do update
        this.attributes.slides[num] = $.extend(s, update);
      } else {
        return s;
      }
    },
    slides: function() {
      return this.attributes.slides;
    }
  });
  
  
  
  Slide = {
    goTo: function(num, transition) {
      // slide left
      var dimensions   = windowDimensions();
      var total_slides = $('#slides .slide').length;
      switch(transition) {
        case 'fade':
          $('#slides .slide').css({top: '0px', left: '0px', opacity: 0, zIndex: 0}).removeClass('active');
          var $current = $('.slide.active'), $next = this.$slide(num);
          $current
            .css({opacity: 1, position:'absolute', top: '0px', left: '0px'})
            .animate({opacity: 0}, function() {
              $(this).css({position: 'static'});
            })
            .removeClass('active');
          $next
            .css({opacity: 0, position:'absolute', top: '0px', left: '0px', zIndex: 10})
            .animate({opacity: 1})
            .addClass('active');
        break;
        case 'slide-left':
          var total_width = total_slides * dimensions.width;
          $('#slides').css({width: total_width});
          var left = dimensions.width * (num - 1);
          $('#slides')
            .animate({marginLeft: -left + 'px'})
            .find('.slide')
              .removeClass('active');
          this.$slide(num).addClass('active');
        break;
        default: //switch
          $('#slides .active').hide().removeClass('active');
          this.$slide(num).addClass('active').show();
        break;
      }
    },
    setContentRatio: function(dimensions) {
      if (!dimensions) dimensions = windowDimensions();
      Sammy.log('setContentRatio', dimensions);
      var ratio = Math.floor((dimensions.width / default_slide_scale.width) * 100);
      Sammy.log(ratio, $('.slide .content'));
      $('.slide.active .content').css({fontSize: ratio + "%"});
      $('.slide.active .content img').each(function() {
        var initial_width;
        if ($(this).data('originalWidth')) {
          initial_width = $(this).data('originalWidth');
        } else {
          initial_width = $(this).width();
          $(this).data('originalWidth', initial_width);
        }
        Sammy.log('set img width', initial_width, 'ratio', ratio);
        $(this).css('width', initial_width * (ratio / 100) + "px");
      });
    },
    setCSS: function(dimensions) {
      if (!dimensions) dimensions = windowDimensions();
      $('#display').css(dimensions);
      Sammy.log('setCSS', dimensions);
      $('.slide').css(dimensions);
      $('#navigation').css({width: dimensions.width});
      this.setContentRatio(dimensions);
      this.setVerticalAlignment(dimensions);
      this.highlightCode();
    },
    setVerticalAlignment: function(dimensions) {
      var $content = $('.slide.active .content');
      var content_height = $content.height();
      var margin = Math.floor((dimensions.height - content_height) / 2);
      Sammy.log('height', dimensions.height, 'content_height', content_height, 'margin', margin);
      if (margin > 0) { $content.css({marginTop: margin + "px"}); }
    },
    highlightCode: function() {
      sh_highlightDocument('javascripts/shjs/lang/', '.min.js');
    },
    $slide: function(num) {
      return $('#slide-' + num);
    }
  };
      
  var app = $.sammy(function() {
    this.debug = true;
    this.element_selector = '#container';
    
    var current_preso = false;
    var current_slide = 1;
    
    var showdown = new Showdown.converter();
    
    var end_block_re = /^\s*@@@\s*$/;
    var start_block_re = /@@@\s([\w\d]+)/;
    
    var display_keymap = {
      37: 'display-prevslide', // left arrow
      38: 'display-prevslide', // up arrow
      39: 'display-nextslide', // right arrow
      40: 'display-nextslide', // down arrow
      32: 'display-togglenav', // space
      27: 'display-exit' // esc
    };
    
    
    function showLoader() {
      var dimensions = windowDimensions()
      $('#modal-loader').css({
        top: Math.floor((dimensions.height / 2) - 100),
        left: Math.floor((dimensions.width / 2) - 100)
      });
      $('#modal-loader').show();
    };
    
    function hideLoader() {
      $('#modal-loader').hide();
    };
    
    this.swap = function(newcontent) {
      hideLoader();
      this.$element().html(newcontent);
    };
    
    this.helpers({
      themes: [
        'basic',
        'nakajima',
        'quirkey'
      ],
      transitions: [
        'switch',
        'fade',
        'slide-left'
      ],
      withCurrentPreso: function(callback) {
        var context = this;
        var wrapped_callback = function(preso) {
          context.setUpLinksForPreso(preso);
          callback.apply(context, [preso]);
        }
        if (current_preso && current_preso.id() == this.params.id) {
          context.log('withCurrentPreso', 'using current', current_preso);
          wrapped_callback(current_preso);
        } else {
          Preso.find(this.params.id, function(p) {
            current_preso = p;
            context.log('withCurrentPreso', 'looked up and found', current_preso);
            // preload the preso attachments
            if (p.attributes._attachments) {
              var attachment_urls = [];
              $.each(p.attributes._attachments, function(k, v) {
                if (k.match(/(jpg|gif|png|bmp)$/)) {
                  attachment_urls.push([p.uri(), k].join('/'));
                }
              });
              preloadImages.apply(preloadImages, attachment_urls);
            }
            wrapped_callback(current_preso);
          });
        }
      },
      displaySlide: function(slide) {
        Slide.goTo(slide.position, slide.transition);
        Slide.setCSS();
        current_slide = slide.position;
      },
      drawSlidePreview: function(val) {
        // calculate dimensions
        var width = ((windowDimensions().width / 2) - 40);
        var height = Math.floor((width * 0.75));
        var dimensions= {
          width: width,
          height: height
        }
        $('.slide .content').html(this.markdown(val));  
        Slide.setCSS(dimensions);
      },
      setSlideTheme: function(theme) {
        $('.slide').attr('class', 'slide active').addClass(theme);
      },
      setUpLinksForPreso: function(preso) {
        var context = this;
        $('.nav a.preso-link').each(function() {
          var meth = $(this).attr('rel');
          $(this).attr('href', context.join('/','#', 'preso', preso.id(), meth));
        });
      },
      markdown: function(text) {
        // includes special code block handling
        var new_text = [];
        var in_code_block = false;
        $.each(text.split(/[\n\r]/), function(i, line) {
          if (!in_code_block) {
            if (line.match(start_block_re)) {
              in_code_block = true;
              new_text.push(line.replace(start_block_re, "<pre class=\"sh_$1\"><code>"));
            } else {
              new_text.push(line);
            }
          } else {
            if (line.match(end_block_re)) {
              in_code_block = false;
              new_text.push("</code></pre>");
            } else {
              new_text.push("" + line);
            }
          }
        });
        return showdown.makeHtml(new_text.join("\n"));
      }
    });
    
    
    this.get('#/', function(e) {
      showLoader();
      this.partial('templates/index.html.erb', function(t) {
        this.app.swap(t);
        Preso.all(function(presos) {
          e.presos = presos;
          e.partial('templates/_presos.html.erb', function(p) {
            $('#presos').append(p);
            Slide.setCSS({width: 300, height: 300});
          });
        });
      });
    });
    
    this.post('#/create', function(e) {
      // TODO: check for validity
      var preso = new Preso({name: this.params['name']});
      preso.save(function() {
        e.redirect('#', 'preso', this.attributes._id, 'edit', '1');
      });
    });
    
    this.get('#/preso/:id/edit/:slide_id', function(e) {
      $('.nav').show();
      showLoader();
      e.withCurrentPreso(function(preso) {
        e.preso = preso;
        e.partial('templates/edit.html.erb', {slide: e.preso.slide(e.params.slide_id)}, function(t) {
          e.app.swap(t);
          e.partial('templates/_upload_form.html.erb', function(data) {
            e.$element().find('#upload_form').html(data);
          });
          $('.slide-form')
            // live preview of slide editing
            .find('textarea[name="content"]')
              .bind('keyup', function() {
                e.drawSlidePreview($(this).val());
              }).trigger('keyup').end()
            .find('textarea[name="additional_css"]')
              .bind('keyup', function() {
                var area = this;
                $('.slide').attr('style', function() {
                  return $(this).attr('style') + ';' + $(area).val();
                });
              }).trigger('keyup').end()
            .find('.theme-select')
              .bind('change', function() {
                e.setSlideTheme($(this).val());
              }).triggerHandler('change');
        });
      });
    });
    
    this.post('#/preso/:id/edit/:slide_id', function(e) {
      e.withCurrentPreso(function(preso) {
        preso.slide(e.params.slide_id, {
          transition: e.params['transition'],
          theme: e.params['theme'],
          content: e.params['content'], 
          content_html: e.markdown(e.params['content']),
          additional_css: e.params['additional_css']
        });
        preso.save(function(p) {
          var next_id = parseInt(e.params.slide_id) + 1;
          e.redirect('#', 'preso', this.attributes._id, 'edit', next_id);
        });
      });
    });
    
    this.get('#/preso/:id/display', function() {
      this.redirect('#', 'preso', this.params.id, 'display', '1');
    });
    
    this.get('#/preso/:id/display/:slide_id', function(e) {
      $('.nav').hide();
      e.withCurrentPreso(function(preso) {
        e.preso = preso;
        // check if display has already been rendered
        if ($('#display[rel="'+ preso.id() + '"]').length > 0) {
          e.displaySlide(preso.slide(e.params.slide_id));
        } else {
          e.partial('templates/display.html.erb', function(display) {
            e.$element().html(display);
            e.displaySlide(preso.slide(e.params.slide_id));
          });
        }
      });
    });
    
    this.get('#/preso/:id/export', function(e) {
      e.withCurrentPreso(function(preso) {
        e.preso = preso;
        e.partial('templates/export.html.erb');
      });
    });
    
    this.post('#/preso/:id/upload', function(e) {
      this.log(e.params);
      e.withCurrentPreso(function(preso) {
        // set _rev
        var $form = e.params['$form'];
        var url = preso.uri() + "?include_docs=true";
        $form.find('input[name="_rev"]').val(preso.attributes._rev);
        // we have to set the action == url
        $form.attr('action', url);
        $form.ajaxSubmit({
          url: url,
          iframe: true,
          success: function(resp) {
            e.log('upload complete', resp);
            preso.reload(function(p) {
              e.preso = p;
              e.partial('templates/_upload_form.html.erb', function(data) {
                e.$element().find('#upload_form').html(data);
              });
            });
          }
        });
      });
    });
       
    this.post('#/preso/:id/jump', function(e) {
      e.withCurrentPreso(function(preso) {
        e.redirect('#', 'preso', preso.id(), 'display', this.params['num']);
      });
    });
    
    this.bind('display-nextslide', function() {
      var e = this;
      e.withCurrentPreso(function(preso) {
        var total_slides = preso.slides().length;
        e.log('total_slides', total_slides, 'current_slide', current_slide);
        if (current_slide && (current_slide + 1) <= total_slides) {
          current_slide += 1
        } else {
          // just go to first slide
          current_slide = 1;
        }
        e.redirect('#', 'preso', preso.id(), 'display', current_slide);
      });
    });
    
    this.bind('display-prevslide', function() {
      var e = this;
      e.withCurrentPreso(function(preso) {
        var total_slides = preso.slides().length;
        e.log('total_slides', total_slides, 'current_slide', current_slide);
        if (current_slide && (current_slide - 1) >= 1) {
          current_slide -= 1
        } else {
          // just go to first slide
          current_slide = total_slides;
        }
        e.redirect('#', 'preso', preso.id(), 'display', current_slide);
      });
    });
    
    this.bind('display-togglenav', function() {
      $('#navigation').toggle();
    });
    
    this.bind('display-exit', function() {
      try {
        var e = this;
        e.withCurrentPreso(function(preso) {
          current_slide = current_slide || 1;
          e.redirect('#', 'preso', preso.id(), 'edit', current_slide);
        });
      } catch(error) {
        e.log(error);
      }
    });
    
    
    this.bind('run', function() {
      // load time
      var context = this;

      $(document)
        .bind('keydown', function(e) {
          if ($('#display').length > 0 && display_keymap[e.which]) { // display is showing
            context.app.trigger(display_keymap[e.which], {id: $('#display').attr('rel')});
          }
        });
      
      $('#presos .preso')
        .live('click', function() {
          context.redirect('#', 'preso', $(this).attr('rel'), 'edit', 1);
        });
      
      $('.linked-button')
        .live('click', function(e) {
          e.preventDefault();
          context.redirect($(this).attr('rel'));
        });
      
      $('.slide-attachment')
        .live('click', function(e) {
          var attachment_url = $(this).attr('rel');
          var attachment_name = $(this).text();
          $('textarea[name="content"]')
             .val($('textarea[name="content"]').val() + "\n![" + attachment_name + "](" + attachment_url + ")")
            .triggerHandler('keyup');
        });
      
      $('#navigation')
        .find('.prev').live('click', function() {
          context.app.trigger('display-prevslide', {id: $('#display').attr('rel')});
        }).end()
        .find('.next').live('click', function() {
          context.app.trigger('display-nextslide', {id: $('#display').attr('rel')});
        });
        
      $(window).bind('resize', function() {
        if ($('#display').length > 0) {
          Slide.setCSS();
        } else {
          $('textarea[name="content"]').triggerHandler('keyup');
        }
      });
        
    });
  });
  
  $(function() {
    app.run('#/');
  });

})(jQuery);