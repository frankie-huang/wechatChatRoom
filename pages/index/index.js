// pages/index/index.js

// 加载配置文件
var config = require('./config.js').config;

var chatModel = 'default'; // 当前的对话模型
var inputValue = ''; // 输入框的值
var waitResponse = false; // 是否等待消息回复中
var msgList = []; // 当前页面所有对话内容（用于页面显示）
var context = []; // 当前对话的所有上下文（用于告知API）

const app = getApp();
// 一些跟页面高度宽度相关的变量
var windowWidth = wx.getSystemInfoSync().windowWidth;
var windowHeight = wx.getSystemInfoSync().windowHeight;
var keyHeight = 0;

/**
 * 初始化数据
 */
function initData(that) {
    // 设置当前页面标题
    wx.setNavigationBarTitle({
        title: config.normalTitle
    })
    // 初始化输入框的值
    inputValue = '';
    // 展示初始信息，speaker为server表示是非用户消息
    config.noticeInfo.forEach(text => msgList.push({
        speaker: 'server',
        contentType: 'text',
        content: text
    }))
    that.setData({
        inputValue,
        msgList
    })
}

/**
 * 计算msg总高度
 */
// function calScrollHeight(that, keyHeight) {
//   var query = wx.createSelectorQuery();
//   query.select('.scrollMsg').boundingClientRect(function(rect) {
//   }).exec();
// }

Page({
    /**
     * 页面的初始数据
     */
    data: {
        scrollHeight: '100vh',
        inputBottom: 0
    },

    /**
     * 生命周期函数--监听页面加载
     */
    onLoad: function (options) {
        initData(this);
    },

    /**
     * 生命周期函数--监听页面显示
     */
    onShow: function () {

    },

    onShareAppMessage: function () {

    },

    onShareTimeline: function () {

    },

    /**
     * 页面相关事件处理函数--监听用户下拉动作
     */
    onPullDownRefresh: function () {

    },

    /**
     * 页面上拉触底事件的处理函数
     */
    onReachBottom: function () {

    },

    /**
     * 获取聚焦，当点击输入框时触发
     */
    focus: function (e) {
        keyHeight = e.detail.height;
        this.setData({
            scrollHeight: (windowHeight - keyHeight) + 'px'
        });
        this.setData({
            toView: 'msg-' + (msgList.length - 1),
            inputBottom: keyHeight + 'px'
        })
        // 计算msg高度
        // calScrollHeight(this, keyHeight);
    },

    /**
     * 失去聚焦（软键盘消失）
     */
    blur: function (e) {
        this.setData({
            scrollHeight: '100vh',
            inputBottom: 0
        })
        this.setData({
            toView: 'msg-' + (msgList.length - 1)
        })
    },

    /**
     * 点击发送时触发
     */
    sendClick: function (e) {
        if (waitResponse) {
            wx.showToast({
                title: '当前消息回复中，请等待',
                icon: 'error',
                duration: 1000
            })
            return;
        }
        // 获取当前输入框的值
        let text = e.detail.value.trim();
        if (!text) {
            wx.showToast({
                title: '请输入内容',
                icon: 'error',
                duration: 1000
            })
            return;
        }
        msgList.push({
            speaker: 'customer',
            contentType: 'text',
            content: text
        })
        // 显示用户消息，清空输入框，设置状态为等待消息中
        this.setData({
            msgList,
            inputValue: '',
            waitResponse: true
        })

        if (text in config.mapOfNumber2ChatModel) {
            // 当输入代数，用于指定对话模型时
            chatModel = config.mapOfNumber2ChatModel[text];
            msgList.push({
                speaker: 'server',
                contentType: 'text',
                content: '切换成功，当前对话模型为：' + chatModel
            })
            this.setData({
                msgList,
                waitResponse: false
            })
        } else {
            wx.setNavigationBarTitle({
                title: config.responseIngTitle
            })
            this.getResponse(text);
        }
    },

    /**
     * 发起请求
     */
    getResponse: function (content) {
        let vm = this;
        wx.request({
            method: 'POST',
            url: config.apiDomain + config.mapOfChatModel2API[chatModel],
            data: {
                messages: context.concat({
                    role: 'user',
                    content
                })
            },
            header: {
                'content-type': 'application/json' // 默认值
            },
            success(res) {
                if (res.statusCode == 200) {
                    if (res.data.code == 0) {
                        let responseText = res.data.text
                        if (responseText.indexOf("\n") != -1) {
                            responseText = responseText.slice(responseText.indexOf("\n") + 1)
                        }
                        msgList.push({
                            speaker: 'server',
                            contentType: 'text',
                            content: responseText
                        })
                        vm.setData({
                            msgList,
                            waitResponse: false
                        });
                        wx.setNavigationBarTitle({
                            title: config.normalTitle
                        });

                        // 触发失焦callback，防止回复的消息被挡住
                        vm.blur();

                        // 消息回复成功，将本次问答加到上下文中
                        context.push({
                            role: 'user',
                            content
                        })
                        context.push({
                            role: 'assistant',
                            content: responseText
                        })
                    } else {
                        vm.retry(content, res.data.msg);
                    }
                } else {
                    vm.retry(content, "请求失败，HTTP状态码为" + res.statusCode);
                }
            },
            fail(err) {
                vm.retry(content, "请求失败，" + err.errMsg);
            }
        })
    },

    /**
     * 消息重试问询
     */
    retry: function (content, errMsg) {
        let vm = this;
        wx.showModal({
            title: '提示',
            content: "错误信息：" + errMsg + "。是否重试？",
            success(res) {
                if (res.confirm) {
                    vm.getResponse(content);
                } else if (res.cancel) {
                    // 不进行重试，将本次问题删除
                    msgList.pop();
                    vm.setData({
                        msgList,
                        waitResponse: false
                    });
                    wx.setNavigationBarTitle({
                        title: config.normalTitle
                    });
                }
            }
        })
    },

    /**
     * 退回上一页
     */
    toBackClick: function () {
        wx.navigateBack({})
    }
})